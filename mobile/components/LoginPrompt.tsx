import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

interface LoginPromptProps {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const LoginPrompt: React.FC<LoginPromptProps> = ({
  title,
  message,
  icon = 'lock-closed-outline',
}) => {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/auth/login');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFFFFF', '#F9FAFB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#91403E', '#7A2F2D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconGradient}
          >
            <Ionicons name={icon} size={52} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#91403E', '#7A2F2D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.loginButtonText}>Login to Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.signupLink}
          onPress={() => router.push('/auth/signup')}
          activeOpacity={0.7}
        >
          <Text style={styles.signupLinkText}>
            Don't have an account? <Text style={styles.signupLinkBold}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  gradient: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 400,
  },
  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: 'hidden',
    marginBottom: 28,
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 14,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  loginButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#91403E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 10,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  signupLink: {
    marginTop: 20,
    paddingVertical: 8,
  },
  signupLinkText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  signupLinkBold: {
    color: '#91403E',
    fontWeight: 'bold',
  },
});

export default LoginPrompt;

