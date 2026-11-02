import { useEffect } from 'react';
import { Image, ImageStyle, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { EVE_AVATAR_URI } from '@/assets/images';
import { theme } from '@/constants/theme';

type EveAvatarProps = {
  uri?: string | null;
  size?: number;
  pulse?: boolean;
  speaking?: boolean;
  online?: boolean;
  ringColor?: string;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
};

export function EveAvatar({
  uri,
  size = 120,
  pulse = false,
  speaking = false,
  online = true,
  ringColor,
  style,
  imageStyle,
}: EveAvatarProps) {
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.5);

  useEffect(() => {
    if (speaking) {
      ringScale.value = withRepeat(
        withTiming(1.12, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      ringOpacity.value = withRepeat(
        withTiming(0.15, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else if (pulse) {
      ringScale.value = withDelay(
        400,
        withRepeat(
          withTiming(1.35, { duration: 2400, easing: Easing.out(Easing.ease) }),
          -1,
          false,
        ),
      );
      ringOpacity.value = withRepeat(
        withDelay(
          400,
          withTiming(0, { duration: 2400, easing: Easing.out(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
      ringScale.value = 1;
      ringOpacity.value = 0;
    }
  }, [speaking, pulse, ringScale, ringOpacity]);

  const animatedRing = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: interpolate(ringOpacity.value, [0, 0.5], [0, 0.5]),
  }));

  const borderColor = ringColor ?? theme.colors.primary[300];
  const imageUri = uri || EVE_AVATAR_URI;

  return (
    <View style={[{ width: size, height: size }, style]}>
      {(pulse || speaking) && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor,
            },
            animatedRing,
          ]}
        />
      )}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 3,
          borderColor,
          overflow: 'hidden',
          backgroundColor: theme.colors.neutral[800],
        }}
      >
        <Image
          source={{ uri: imageUri }}
          style={[{ width: '100%', height: '100%' }, imageStyle]}
          resizeMode="cover"
        />
      </View>
      {online && (
        <View
          style={{
            position: 'absolute',
            bottom: size * 0.05,
            right: size * 0.05,
            width: size * 0.16,
            height: size * 0.16,
            borderRadius: size * 0.08,
            backgroundColor: theme.colors.success[500],
            borderWidth: 3,
            borderColor: theme.colors.neutral[900],
          }}
        />
      )}
    </View>
  );
}
