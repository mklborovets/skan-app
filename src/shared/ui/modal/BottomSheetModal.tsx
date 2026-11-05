import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';
import {theme} from '@shared/config/theme';
import {IconButton} from '@shared/ui/button/IconButton';
import {Row} from '@shared/ui/layout/Row';
import {AppText} from '@shared/ui/typography/AppText';

export interface BottomSheetModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  visible,
  title,
  onClose,
  children,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Row justify="space-between" style={styles.header}>
            <AppText variant="h3">{title}</AppText>
            <IconButton icon="close" size={34} iconSize={18} onPress={onClose} />
          </Row>
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.surfaceOverlay,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginBottom: theme.spacing.sm,
  },
  header: {
    marginBottom: theme.spacing.md,
  },
  body: {
    gap: theme.spacing.sm,
  },
});
