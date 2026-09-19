import { useBIOPHLXTheme } from '../../Theme/BIOPHLXTheme';
// CustomButton.js

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Colors from '../../Theme/Colors';

const CustomButton = ({ title, onPress, buttonStyle, textStyle }) => {
  const brandTheme = useBIOPHLXTheme();
  const styles = brandTheme.styles(baseStyles);

  return (
    <TouchableOpacity
      style={brandTheme.style([styles.button, buttonStyle])}
      onPress={onPress}
    >
      <Text style={[{color:brandTheme.colors.text}, brandTheme.style([styles.text, textStyle])]}>{title}</Text>
    </TouchableOpacity>
  );
};

const baseStyles = StyleSheet.create({
  button: {
    backgroundColor: Colors.APP_WHITE, // Example background color
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10, // Border radius
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  text: {
    color: Colors.APP_RED, // Example text color
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CustomButton;
