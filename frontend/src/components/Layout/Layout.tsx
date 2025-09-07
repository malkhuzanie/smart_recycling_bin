import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  IconButton,
  Avatar,
  Badge,
  Tooltip,
  useTheme,
  useMediaQuery,
  Chip,
  Divider,
} from '@mui/material';
import {
  Dashboard,
  History,
  HealthAndSafety,
  Menu as MenuIcon,
  RecyclingOutlined,
  NotificationsOutlined,
  Settings,
  Close as CloseIcon,
  Analytics,
  Visibility,
  CameraAlt,
  Description as LogsIcon, 
  MonitorHeart,
  Assessment,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 300;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    isConnected: false,
    cameraConnected: false,
    processingActive: false
  });

  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <Dashboard />,
      path: '/dashboard',
      color: '#1976d2',
      description: 'Overview & Statistics',
    },
    {
      text: 'Live Classification',
      icon: <CameraAlt />,
      path: '/live',
      color: '#ed6c02',
      description: 'Real-time Item Processing',
      isNew: true,
    },
    {
      text: 'Classification History',
      icon: <History />,
      path: '/classifications',
      color: '#388e3c',
      description: 'Past Classifications',
    },
    {
      text: 'System Health',
      icon: <MonitorHeart />,
      path: '/system',
      color: '#d32f2f',
      description: 'System Monitoring',
    },
    {
      text: 'Logs',
      icon: <LogsIcon />,
      path: '/logs',
      color: '#546e7a',
      description: 'Live Service Logs',
    },
    {
      text: 'Analytics',
      icon: <Assessment />,
      path: '/analytics',
      color: '#7b1fa2',
      description: 'Performance Analytics',
      disabled: true,
    },
  ];

  const adminMenuItems = [
    {
      text: 'Settings',
      icon: <Settings />,
      path: '/settings',
      color: '#455a64',
      description: 'System Configuration',
      disabled: true,
    },
  ];

  const isSelected = (path: string) => {
    if (path === '/dashboard' && (location.pathname === '/' || location.pathname === '/dashboard')) {
      return true;
    }
    return location.pathname === path;
  };

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)',
    }}>
      {/* Logo Section */}
      <Box sx={{ 
        p: 3, 
        display: 'flex', 
        alignItems: 'center', 
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
        color: 'white',
        borderRadius: 0
      }}>
        <RecyclingOutlined sx={{ mr: 2, fontSize: 32 }} />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Smart Recycling
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, fontSize: '0.75rem' }}>
            Expert Classification System
          </Typography>
        </Box>
      </Box>

      {/* System Status Indicator */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            System Status
          </Typography>
          <Chip
            size="small"
            label={systemStatus.isConnected ? 'Online' : 'Offline'}
            color={systemStatus.isConnected ? 'success' : 'error'}
            variant="filled"
            sx={{ 
              fontSize: '0.7rem',
              height: 20,
              fontWeight: 600
            }}
          />
        </Box>
        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
          <Chip
            size="small"
            label="Camera"
            color={systemStatus.cameraConnected ? 'success' : 'default'}
            variant="outlined"
            sx={{ fontSize: '0.65rem', height: 18 }}
          />
          <Chip
            size="small"
            label="Processing"
            color={systemStatus.processingActive ? 'warning' : 'default'}
            variant="outlined"
            sx={{ fontSize: '0.65rem', height: 18 }}
          />
        </Box>
      </Box>

      {/* Main Navigation */}
      <Box sx={{ flex: 1, py: 1 }}>
        <Typography 
          variant="overline" 
          sx={{ 
            px: 3, 
            py: 1, 
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.7rem'
          }}
        >
          Main Navigation
        </Typography>
        <List sx={{ px: 1 }}>
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={isSelected(item.path)}
                onClick={() => {
                  if (!item.disabled) {
                    navigate(item.path);
                    if (isMobile) {
                      setMobileOpen(false);
                    }
                  }
                }}
                disabled={item.disabled}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  mb: 0.5,
                  minHeight: 48,
                  '&.Mui-selected': {
                    backgroundColor: `${item.color}15`,
                    borderLeft: `4px solid ${item.color}`,
                    '& .MuiListItemIcon-root': {
                      color: item.color,
                    },
                    '& .MuiListItemText-primary': {
                      color: item.color,
                      fontWeight: 600,
                    },
                  },
                  '&:hover': {
                    backgroundColor: item.disabled ? 'transparent' : `${item.color}08`,
                  },
                  opacity: item.disabled ? 0.5 : 1,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.text}
                      </Typography>
                      {item.isNew && (
                        <Chip
                          label="New"
                          size="small"
                          color="warning"
                          variant="filled"
                          sx={{ 
                            fontSize: '0.6rem', 
                            height: 16,
                            fontWeight: 600
                          }}
                        />
                      )}
                    </Box>
                  }
                  secondary={item.description}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    color: 'text.secondary',
                    sx: { fontSize: '0.7rem' }
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 2, mx: 2 }} />

        {/* Admin Section */}
        <Typography 
          variant="overline" 
          sx={{ 
            px: 3, 
            py: 1, 
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.7rem'
          }}
        >
          Administration
        </Typography>
        <List sx={{ px: 1 }}>
          {adminMenuItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                selected={isSelected(item.path)}
                onClick={() => {
                  if (!item.disabled) {
                    navigate(item.path);
                    if (isMobile) {
                      setMobileOpen(false);
                    }
                  }
                }}
                disabled={item.disabled}
                sx={{
                  borderRadius: 2,
                  mx: 1,
                  mb: 0.5,
                  minHeight: 48,
                  opacity: item.disabled ? 0.5 : 1,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  secondary={item.description}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: 500
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    color: 'text.secondary',
                    sx: { fontSize: '0.7rem' }
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Footer */}
      <Box sx={{ 
        p: 2, 
        borderTop: '1px solid rgba(0,0,0,0.08)',
        backgroundColor: 'rgba(255,255,255,0.5)'
      }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          Smart Recycling Bin v1.0
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
          Expert System Integration
        </Typography>
      </Box>
    </Box>
  );

  if (!mounted) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backgroundColor: 'white',
          color: 'text.primary',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>
            {menuItems.find(item => isSelected(item.path))?.text || 'Smart Recycling Bin'}
          </Typography>

          {/* Header Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Notifications">
              <IconButton color="inherit">
                <Badge badgeContent={0} color="error">
                  <NotificationsOutlined />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title="Operator Profile">
              <IconButton>
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                  O
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        aria-label="navigation folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth 
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              position: 'relative',
              height: '100vh',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Toolbar /> {/* Spacing for fixed AppBar */}
        <Box sx={{ 
          flex: 1, 
          overflow: 'auto',
          p: 2,
          backgroundColor: 'background.default'
        }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
