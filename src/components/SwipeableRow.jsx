import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BUTTON_WIDTH = 80;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.45;

export default function SwipeableRow({ children, onDelete, isAR = false, isDark = false, visible = true, backgroundStyle = null }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  // Reset swipe position if the row becomes hidden or gets updated
  useEffect(() => {
    if (!visible) {
      close();
    }
  }, [visible]);

  const close = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
    isOpen.current = false;
  };

  const open = () => {
    Animated.spring(translateX, {
      toValue: isAR ? BUTTON_WIDTH : -BUTTON_WIDTH,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
    isOpen.current = true;
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Detect horizontal swipe gestures
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy);
      },
      onPanResponderGrant: () => {
        translateX.setOffset(isOpen.current ? (isAR ? BUTTON_WIDTH : -BUTTON_WIDTH) : 0);
        translateX.setValue(0);
      },
      onPanResponderMove: (evt, gestureState) => {
        const { dx } = gestureState;
        let nextValue = dx;

        // Apply offsets and limits depending on language direction (isAR)
        if (isAR) {
          // Swipe right to delete (Arabic)
          if (isOpen.current) {
            nextValue = Math.max(-BUTTON_WIDTH, dx);
          } else {
            nextValue = Math.max(0, dx);
          }
        } else {
          // Swipe left to delete (English)
          if (isOpen.current) {
            nextValue = Math.min(BUTTON_WIDTH, dx);
          } else {
            nextValue = Math.min(0, dx);
          }
        }

        translateX.setValue(nextValue);
      },
      onPanResponderRelease: (evt, gestureState) => {
        translateX.flattenOffset();
        const { dx } = gestureState;

        if (isAR) {
          // Arabic Release logic
          if (dx > SWIPE_THRESHOLD) {
            // Animate fully off screen right and trigger delete
            Animated.timing(translateX, {
              toValue: SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }).start(() => onDelete());
          } else {
            if (isOpen.current) {
              if (dx < -BUTTON_WIDTH / 2) {
                close();
              } else {
                open();
              }
            } else {
              if (dx > BUTTON_WIDTH / 2) {
                open();
              } else {
                close();
              }
            }
          }
        } else {
          // English Release logic
          if (dx < -SWIPE_THRESHOLD) {
            // Animate fully off screen left and trigger delete
            Animated.timing(translateX, {
              toValue: -SCREEN_WIDTH,
              duration: 200,
              useNativeDriver: true,
            }).start(() => onDelete());
          } else {
            if (isOpen.current) {
              if (dx > BUTTON_WIDTH / 2) {
                close();
              } else {
                open();
              }
            } else {
              if (dx < -BUTTON_WIDTH / 2) {
                open();
              } else {
                close();
              }
            }
          }
        }
      },
      onPanResponderTerminate: () => {
        translateX.flattenOffset();
        close();
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Background full-width swipe/tap delete area */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          close();
          onDelete();
        }}
        style={[
          styles.background,
          {
            flexDirection: isAR ? 'row' : 'row-reverse',
            backgroundColor: '#FF4444',
          },
          backgroundStyle,
        ]}
      >
        <View style={styles.deleteBtnContent}>
          <Ionicons name="trash-outline" size={24} color="#FFF" />
          <Text style={styles.deleteText}>{isAR ? 'حذف' : 'Delete'}</Text>
        </View>
      </TouchableOpacity>

      {/* Foreground Swipeable Content */}
      <Animated.View
        style={{
          transform: [{ translateX }],
          backgroundColor: 'transparent',
        }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  background: {
    position: 'absolute',
    top: 6,
    bottom: 0,
    left: 16,
    right: 16,
    borderRadius: 14,
    alignItems: 'center',
    zIndex: 0,
  },
  deleteBtnContent: {
    width: BUTTON_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 4,
  },
  deleteText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
