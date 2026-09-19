import { useBIOPHLXTheme } from '../Theme/BIOPHLXTheme';
import React, { useEffect } from 'react';
import { View, StyleSheet, PermissionsAndroid, Platform } from 'react-native';
import { Authenticator } from '@aws-amplify/ui-react-native';

const AuthScreen = () => {
  const brandTheme = useBIOPHLXTheme();
  const styles = brandTheme.styles(baseStyles);

  useEffect(() => {
    const requestBlePermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
        } catch (err) {
          console.warn('BLE permission request failed', err);
        }
      }
    };

    requestBlePermissions();
  }, []);

  return (
    <View style={brandTheme.style(styles.container)}>
      <Authenticator />
    </View>
  );
};

export default AuthScreen;

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
