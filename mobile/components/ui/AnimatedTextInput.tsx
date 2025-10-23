import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Animated,
  Easing,
  TouchableWithoutFeedback,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { TextInputProps } from 'react-native';

// Using the color from your tailwind.config.js
const SCREEN_BACKGROUND_COLOR = '#E9ECEC'; 

interface AnimatedTextInputProps extends TextInputProps {
  label: string;
  labelColor?: string;
  activeLabelColor?: string;
  borderColor?: string;
  activeBorderColor?: string;
  error?: boolean;
  errorColor?: string;
  containerStyle?: object; 
  inputStyle?: object;
  inputContainerStyle?: object;
}

const AnimatedTextInput: React.FC<AnimatedTextInputProps> = ({
  label,
  value,
  onChangeText,
  onFocus,
  onBlur,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  editable,
  labelColor = '#6b7280', // Default gray-500
  activeLabelColor = '#91403E', // Default cordovan
  borderColor = '#cbd5e1', // Default slate-300
  activeBorderColor = '#91403E', // Default cordovan
  errorColor = '#ef4444', // Default red-500
  error = false,
  containerStyle = {},
  inputStyle = {},
  inputContainerStyle = {},
  ...restOfProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const animatedValue = useRef(new Animated.Value(value && value.length > 0 ? 1 : 0)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused || (value && value.length > 0) ? 1 : 0,
      duration: 200,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false, // Must be false for layout properties like fontSize, top, paddingHorizontal
    }).start();
  }, [isFocused, value, animatedValue]);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const labelContainerStyle = {
    position: 'absolute' as 'absolute',
    left: 12, // Adjusted for better alignment
    top: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [16, -10], // Move label up and out of the input area
    }),
    zIndex: 10, // Increased zIndex to ensure label is above shadow and border
    paddingHorizontal: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 4], // Add padding when floated
      }),
    backgroundColor: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['transparent', SCREEN_BACKGROUND_COLOR], // Screen background for notch
    }),
  };

  const labelTextStyle = {
    fontSize: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 12], 
    }),
    color: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [labelColor, error ? errorColor : activeLabelColor],
    }),
  };

  const currentBorderColor = error ? errorColor : (isFocused ? activeBorderColor : borderColor);
  const inputHeight = 50; // Define a consistent height

  const animatedBorderStyle = {
    borderColor: currentBorderColor,
    borderWidth: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.7], // Thinner when unfocused, thicker when focused/has value
    }),
    shadowOpacity: animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0, Platform.OS === 'ios' ? 0.1 : 0.2], // More subtle shadow for iOS, slightly more for Android
    }),
    elevation: animatedValue.interpolate({
        inputRange: [0,1],
        outputRange: [0, Platform.OS === 'android' ? 3: 0]
    })
  };

  return (
    <Animated.View style={[styles.outerContainer, containerStyle]}>
      <Animated.View style={labelContainerStyle}>
        <TouchableWithoutFeedback onPress={() => inputRef.current?.focus()}>
            <Animated.Text style={labelTextStyle}>{label}</Animated.Text>
        </TouchableWithoutFeedback>
      </Animated.View>
      <Animated.View style={[styles.inputContainer, animatedBorderStyle, inputContainerStyle]}>
        <TextInput
          ref={inputRef}
          {...restOfProps}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          style={[
            styles.input,
            { height: inputHeight },
            inputStyle,
          ]}
          placeholderTextColor={labelColor} // Use label color for placeholder when not focused
          placeholder={isFocused || (value && value.length > 0) ? '' : ''} 
        />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginBottom: 22, // Slightly more spacing
    width: '100%',
  },
  inputContainer: { // New container for shadow and border styling
    borderRadius: 10, // Slightly more rounded
    backgroundColor: '#FFFFFF', // Background for the input area, helps with shadow
    // Shadow properties for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    // Elevation for Android is handled by animatedBorderStyle.elevation
  },
  input: {
    paddingHorizontal: 16,
    paddingTop: 16, // Adjusted padding
    paddingBottom: 8,
    fontSize: 16,
    color: '#1f2937', // darker gray for text (gray-800)
    backgroundColor: 'transparent', // Input itself is transparent, relying on inputContainer
    borderWidth: 0, // Border is now on inputContainer
  },
});

export default AnimatedTextInput; 