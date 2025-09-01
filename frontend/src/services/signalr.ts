import * as signalR from '@microsoft/signalr';
import { 
  ClassificationResult, 
  ClassificationTriggeredMessage,
  SystemAlert,
  DashboardUpdate 
} from '../types';

class SignalRService {
  private classificationConnection: signalR.HubConnection | null = null;
  private dashboardConnection: signalR.HubConnection | null = null;
  private connectionCallbacks: Array<(connected: boolean, hubName: string) => void> = [];
  private classificationCallbacks: Array<(result: ClassificationResult) => void> = [];
  private triggerCallbacks: Array<(data: ClassificationTriggeredMessage) => void> = [];
  private alertCallbacks: Array<(alert: SystemAlert) => void> = [];
  private dashboardCallbacks: Array<(update: DashboardUpdate) => void> = [];

  private readonly baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5099';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private connectionTimeout = 15000; // Increased timeout
  private isConnecting = false; // Prevent multiple connection attempts

  // Classification Hub Connection with better state management
  async startClassificationHub(): Promise<void> {
    if (this.classificationConnection?.state === signalR.HubConnectionState.Connected) {
      console.log('Classification hub already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('Classification hub connection already in progress');
      return;
    }

    this.isConnecting = true;

    try {
      // Clean up any existing connection
      if (this.classificationConnection) {
        await this.cleanupConnection(this.classificationConnection);
        this.classificationConnection = null;
      }

      // Create connection with improved configuration
      this.classificationConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${this.baseUrl}/hubs/classification`, {
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
          skipNegotiation: false,
          timeout: this.connectionTimeout,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          // Add access token if needed
          // accessTokenFactory: () => this.getAccessToken()
        })
        .withAutomaticReconnect([0, 1000, 5000, 15000, 30000])
        .withHubProtocol(new signalR.JsonHubProtocol())
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Setup event handlers before starting connection
      this.setupClassificationEventHandlers();

      // Start connection
      await this.classificationConnection.start();

      console.log('Classification hub connected successfully');
      this.connectionCallbacks.forEach(callback => callback(true, 'classification'));
      this.reconnectAttempts = 0;
      
      // Join the classification group with retry logic
      await this.joinClassificationGroupWithRetry();
      
    } catch (error) {
      console.error('Failed to connect to classification hub:', error);
      this.connectionCallbacks.forEach(callback => callback(false, 'classification'));
      
      // Cleanup failed connection
      if (this.classificationConnection) {
        await this.cleanupConnection(this.classificationConnection);
        this.classificationConnection = null;
      }
      
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  // Dashboard Hub Connection with improved error handling  
  async startDashboardHub(): Promise<void> {
    if (this.dashboardConnection?.state === signalR.HubConnectionState.Connected) {
      console.log('Dashboard hub already connected');
      return;
    }

    try {
      // Clean up any existing connection
      if (this.dashboardConnection) {
        await this.cleanupConnection(this.dashboardConnection);
        this.dashboardConnection = null;
      }

      this.dashboardConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${this.baseUrl}/hubs/dashboard`, {
          transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
          skipNegotiation: false,
          timeout: this.connectionTimeout,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        })
        .withAutomaticReconnect([0, 1000, 5000, 15000, 30000])
        .withHubProtocol(new signalR.JsonHubProtocol())
        .configureLogging(signalR.LogLevel.Information)
        .build();

      // Setup event handlers before starting connection
      this.setupDashboardEventHandlers();

      // Start connection
      await this.dashboardConnection.start();

      console.log('Dashboard hub connected successfully');
      this.connectionCallbacks.forEach(callback => callback(true, 'dashboard'));
      
      // Join the dashboard group with retry logic
      await this.joinDashboardGroupWithRetry();
      
    } catch (error) {
      console.error('Failed to connect to dashboard hub:', error);
      this.connectionCallbacks.forEach(callback => callback(false, 'dashboard'));
      
      // Cleanup failed connection
      if (this.dashboardConnection) {
        await this.cleanupConnection(this.dashboardConnection);
        this.dashboardConnection = null;
      }
      
      throw error;
    }
  }

  // Helper method to properly cleanup connections
  private async cleanupConnection(connection: signalR.HubConnection): Promise<void> {
    try {
      if (connection.state === signalR.HubConnectionState.Connected || 
          connection.state === signalR.HubConnectionState.Connecting ||
          connection.state === signalR.HubConnectionState.Reconnecting) {
        await connection.stop();
      }
    } catch (error) {
      console.warn('Error cleaning up connection:', error);
    }
  }

  // Improved event handler setup for classification hub
  private setupClassificationEventHandlers(): void {
    if (!this.classificationConnection) return;

    // Remove any existing handlers to prevent duplicates
    this.classificationConnection.off('ClassificationResult');
    this.classificationConnection.off('ClassificationTriggered');
    this.classificationConnection.off('SystemAlert');
    this.classificationConnection.off('Connected');
    this.classificationConnection.off('JoinedClassificationGroup');

    // Event handlers for classification hub
    this.classificationConnection.on('ClassificationResult', (result: ClassificationResult) => {
      console.log('Received classification result:', result);
      this.classificationCallbacks.forEach(callback => callback(result));
    });

    this.classificationConnection.on('ClassificationTriggered', (data: ClassificationTriggeredMessage) => {
      console.log('Classification triggered:', data);
      this.triggerCallbacks.forEach(callback => callback(data));
    });

    this.classificationConnection.on('SystemAlert', (alert: SystemAlert) => {
      console.log('System alert:', alert);
      this.alertCallbacks.forEach(callback => callback(alert));
    });

    this.classificationConnection.on('Connected', (data: any) => {
      console.log('Classification hub connected:', data);
    });

    this.classificationConnection.on('JoinedClassificationGroup', (data: any) => {
      console.log('Joined classification group:', data);
    });

    // Connection state handlers with better error handling
    this.classificationConnection.onclose((error) => {
      console.log('Classification hub connection closed:', error);
      this.connectionCallbacks.forEach(callback => callback(false, 'classification'));
    });

    this.classificationConnection.onreconnecting((error) => {
      console.log('Classification hub reconnecting:', error);
      this.connectionCallbacks.forEach(callback => callback(false, 'classification'));
    });

    this.classificationConnection.onreconnected((connectionId) => {
      console.log('Classification hub reconnected:', connectionId);
      this.connectionCallbacks.forEach(callback => callback(true, 'classification'));
      // Re-join group after reconnection
      this.joinClassificationGroupWithRetry();
    });
  }

  // Improved event handler setup for dashboard hub
  private setupDashboardEventHandlers(): void {
    if (!this.dashboardConnection) return;

    // Remove any existing handlers to prevent duplicates
    this.dashboardConnection.off('DashboardUpdate');
    this.dashboardConnection.off('SystemStatusUpdate');
    this.dashboardConnection.off('StatsUpdate');
    this.dashboardConnection.off('Connected');
    this.dashboardConnection.off('JoinedDashboardGroup');

    // Event handlers for dashboard hub
    this.dashboardConnection.on('DashboardUpdate', (update: DashboardUpdate) => {
      console.log('Dashboard update received:', update);
      this.dashboardCallbacks.forEach(callback => callback(update));
    });

    this.dashboardConnection.on('SystemStatusUpdate', (status: any) => {
      console.log('System status update:', status);
      this.dashboardCallbacks.forEach(callback => 
        callback({
          type: 'status',
          data: status,
          timestamp: new Date().toISOString(),
        })
      );
    });

    this.dashboardConnection.on('StatsUpdate', (stats: any) => {
      console.log('Stats update:', stats);
      this.dashboardCallbacks.forEach(callback => 
        callback({
          type: 'stats',
          data: stats,
          timestamp: new Date().toISOString(),
        })
      );
    });

    this.dashboardConnection.on('Connected', (data: any) => {
      console.log('Dashboard hub connected:', data);
    });

    this.dashboardConnection.on('JoinedDashboardGroup', (data: any) => {
      console.log('Joined dashboard group:', data);
    });

    // Connection state handlers
    this.dashboardConnection.onclose((error) => {
      console.log('Dashboard hub connection closed:', error);
      this.connectionCallbacks.forEach(callback => callback(false, 'dashboard'));
    });

    this.dashboardConnection.onreconnecting((error) => {
      console.log('Dashboard hub reconnecting:', error);
      this.connectionCallbacks.forEach(callback => callback(false, 'dashboard'));
    });

    this.dashboardConnection.onreconnected((connectionId) => {
      console.log('Dashboard hub reconnected:', connectionId);
      this.connectionCallbacks.forEach(callback => callback(true, 'dashboard'));
      // Re-join group after reconnection
      this.joinDashboardGroupWithRetry();
    });
  }

  // Helper methods for joining groups with retry logic
  private async joinClassificationGroupWithRetry(maxRetries = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (this.classificationConnection?.state === signalR.HubConnectionState.Connected) {
          await this.classificationConnection.invoke('JoinClassificationGroup');
          console.log('Successfully joined classification group');
          return;
        } else {
          throw new Error('Connection not ready');
        }
      } catch (error) {
        console.error(`Failed to join classification group (attempt ${attempt}/${maxRetries}):`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }
    }
    console.error('Failed to join classification group after all attempts');
  }

  private async joinDashboardGroupWithRetry(maxRetries = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (this.dashboardConnection?.state === signalR.HubConnectionState.Connected) {
          await this.dashboardConnection.invoke('JoinDashboardGroup');
          console.log('Successfully joined dashboard group');
          return;
        } else {
          throw new Error('Connection not ready');
        }
      } catch (error) {
        console.error(`Failed to join dashboard group (attempt ${attempt}/${maxRetries}):`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }
    }
    console.error('Failed to join dashboard group after all attempts');
  }

  // Public methods to request data with connection state validation
  async requestSystemStatus(): Promise<void> {
    if (this.dashboardConnection?.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Dashboard hub not connected');
    }

    try {
      await this.dashboardConnection.invoke('RequestSystemStatus');
      console.log('System status requested successfully');
    } catch (error) {
      console.error('Failed to request system status:', error);
      throw error;
    }
  }

  async requestStats(fromDate?: Date, toDate?: Date): Promise<void> {
    if (this.dashboardConnection?.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Dashboard hub not connected');
    }

    try {
      await this.dashboardConnection.invoke('RequestStats', fromDate, toDate);
      console.log('Stats requested successfully');
    } catch (error) {
      console.error('Failed to request stats:', error);
      throw error;
    }
  }

  // Stop both connections with proper cleanup
  async stopConnections(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.classificationConnection) {
      promises.push(this.cleanupConnection(this.classificationConnection));
    }

    if (this.dashboardConnection) {
      promises.push(this.cleanupConnection(this.dashboardConnection));
    }

    try {
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Error stopping connections:', error);
    } finally {
      this.classificationConnection = null;
      this.dashboardConnection = null;
      console.log('All SignalR connections stopped');
    }
  }

  // Event subscribers
  onClassificationResultReceived(callback: (result: ClassificationResult) => void): void {
    this.classificationCallbacks.push(callback);
  }

  onClassificationTriggeredReceived(callback: (data: ClassificationTriggeredMessage) => void): void {
    this.triggerCallbacks.push(callback);
  }

  onSystemAlertReceived(callback: (alert: SystemAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  onDashboardUpdateReceived(callback: (update: DashboardUpdate) => void): void {
    this.dashboardCallbacks.push(callback);
  }

  onConnectionStateChange(callback: (connected: boolean, hubName: string) => void): void {
    this.connectionCallbacks.push(callback);
  }

  // Send methods
  async sendManualOverride(classificationId: number, newClassification: string, reason: string): Promise<void> {
    if (!this.classificationConnection || this.classificationConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Classification hub not connected');
    }

    await this.classificationConnection.invoke('SendManualOverride', {
      classificationId,
      newClassification,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  // Connection status getters with improved reliability
  get classificationConnected(): boolean {
    return this.classificationConnection?.state === signalR.HubConnectionState.Connected;
  }

  get dashboardConnected(): boolean {
    return this.dashboardConnection?.state === signalR.HubConnectionState.Connected;
  }

  get isConnected(): boolean {
    return this.classificationConnected && this.dashboardConnected;
  }

  // Connection health check method
  async checkConnectionHealth(): Promise<{ classification: boolean; dashboard: boolean }> {
    const classificationHealthy = this.classificationConnected;
    const dashboardHealthy = this.dashboardConnected;

    return {
      classification: classificationHealthy,
      dashboard: dashboardHealthy
    };
  }
}

// Singleton instance
const signalRService = new SignalRService();
export default signalRService;
