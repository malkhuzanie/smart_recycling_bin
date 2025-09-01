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
  Fade,
  Grow,
  Chip,
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
  Refresh,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 280;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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
    },
    {
      text: 'Classification History',
      icon: <History />,
      path: '/classifications',
      color: '#388e3c',
    },
    {
      text: 'System Health',
      icon: <HealthAndSafety />,
      path: '/system',
      color: '#f57c00',
    },
    {
      text: 'Analytics',
      icon: <Analytics />,
      path: '/analytics',
      color: '#7b1fa2',
    },
    {
      text: 'Settings',
      icon: <Settings />,
      path: '/settings',
      color: '#455a64',
    },
  ];

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)',
      position: 'relative',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.1) 100%)',
        backdropFilter: 'blur(10px)',
        borderRight: '1px solid rgba(255,255,255,0.2)',
      }
    }}>
      {/* Header Section */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          p: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 2,
                backdropFilter: 'blur(10px)',
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.05)' },
                },
              }}
            >
              <RecyclingOutlined sx={{ fontSize: 28, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Smart Recycling
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9, fontSize: 12 }}>
                AI-Powered Sorting System
              </Typography>
            </Box>
          </Box>
          {isMobile && (
            <IconButton color="inherit" onClick={handleDrawerToggle}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Status Indicators */}
      <Box sx={{ position: 'relative', zIndex: 1, p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Chip
            label="Expert System Active"
            sx={{
              background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
              color: 'white',
              fontWeight: 600,
              width: '100%',
              height: 40,
              fontSize: '0.875rem',
              '& .MuiChip-label': { px: 2 },
            }}
          />
        </Box>
        
        <Box
          sx={{
            background: 'rgba(255,255,255,0.9)',
            borderRadius: 2,
            p: 2,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <Typography variant="caption" color="text.secondary" gutterBottom display="block">
            CNN Model v3.93 Performance
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            94.2%
          </Typography>
          <Box
            sx={{
              height: 8,
              borderRadius: 4,
              background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              position: 'relative',
              overflow: 'hidden',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                animation: 'shimmer 2s infinite',
              },
              '@keyframes shimmer': {
                '0%': { transform: 'translateX(-100%)' },
                '100%': { transform: 'translateX(100%)' },
              },
            }}
          />
        </Box>
      </Box>

      {/* Navigation Menu */}
      <Box sx={{ position: 'relative', zIndex: 1, flex: 1, px: 2 }}>
        <List sx={{ pt: 1 }}>
          {menuItems.map((item, index) => (
            <Grow
              in={mounted}
              timeout={300 + index * 100}
              key={item.text}
            >
              <ListItem disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMobileOpen(false);
                  }}
                  sx={{
                    borderRadius: 3,
                    py: 1.5,
                    px: 2,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&.Mui-selected': {
                      background: `linear-gradient(135deg, ${item.color}15 0%, ${item.color}05 100%)`,
                      backdropFilter: 'blur(10px)',
                      border: `1px solid ${item.color}30`,
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        background: `linear-gradient(180deg, ${item.color} 0%, ${item.color}80 100%)`,
                        borderRadius: '0 4px 4px 0',
                      },
                      '& .MuiListItemIcon-root': {
                        color: item.color,
                        transform: 'scale(1.1)',
                      },
                      '& .MuiListItemText-primary': {
                        color: item.color,
                        fontWeight: 600,
                      },
                    },
                    '&:hover': {
                      background: `${item.color}08`,
                      transform: 'translateX(4px)',
                      '& .MuiListItemIcon-root': {
                        transform: 'scale(1.05)',
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 48,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      sx: {
                        fontSize: 14,
                        fontWeight: location.pathname === item.path ? 600 : 500,
                        transition: 'all 0.3s ease',
                      }
                    }}
                  />
                  {location.pathname === item.path && (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: item.color,
                        ml: 1,
                        boxShadow: `0 0 12px ${item.color}60`,
                      }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            </Grow>
          ))}
        </List>
      </Box>

      {/* Footer */}
      <Box sx={{ position: 'relative', zIndex: 1, p: 2, textAlign: 'center' }}>
        <Box
          sx={{
            background: 'rgba(255,255,255,0.9)',
            borderRadius: 2,
            p: 2,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Version 1.0.0 | Expert System
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
            Real-time Classification
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Smart Recycling Control Center
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Real-time monitoring and classification system
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title="Refresh System">
              <IconButton>
                <Refresh />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Notifications">
              <IconButton>
                <Badge badgeContent={3} color="error">
                  <NotificationsOutlined />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <Chip
              label="SYSTEM ONLINE"
              sx={{
                background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
                color: 'white',
                fontWeight: 600,
                px: 2,
                animation: 'statusPulse 3s ease-in-out infinite',
                '@keyframes statusPulse': {
                  '0%, 100%': { boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)' },
                  '50%': { boxShadow: '0 4px 16px rgba(76, 175, 80, 0.5)' },
                },
              }}
            />

            <Avatar
              sx={{
                width: 40,
                height: 40,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                },
              }}
            >
              BN
            </Avatar>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              border: 'none',
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
              border: 'none',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content - FIXED MARGINS */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 20%, rgba(102, 126, 234, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(118, 75, 162, 0.1) 0%, transparent 50%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Toolbar />
        {/* REMOVED CONTAINER AND PADDING - FULL WIDTH */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            margin: 0,
            padding: 0,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
