import React from 'react';
import {StyleProp, Text, TextProps, TextStyle} from 'react-native';
import {theme, ThemeColorKey, TypographyVariant} from '@shared/config/theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: ThemeColorKey;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  color = 'textPrimary',
  align = 'left',
  style,
  children,
  ...rest
}) => {
  const variantStyle = theme.typography[variant];
  const textColor = theme.colors[color];

  return (
    <Text
      style={[
        variantStyle,
        {color: textColor, textAlign: align},
        style,
      ]}
      {...rest}>
      {children}
    </Text>
  );
};
