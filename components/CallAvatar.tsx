import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import { EveAvatar } from '@/components/EveAvatar';
import { theme } from '@/constants/theme';

type CallAvatarProps = {
  uri?: string | null;
  speaking: boolean;
  thinking: boolean;
  size?: number;
};

const BREATH_MS = 3800;
const SWAY_MS = 6200;
const FLOAT_MS = 4900;

export function CallAvatar({ uri, speaking, thinking, size = 180 }: CallAvatarProps) {
  const breath = useSharedValue(0);
  const sway = useSharedValue(0);
  const float = useSharedValue(0);
  const talk = useSharedValue(1);
  const ringProgress = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    sway.value = withRepeat(
      withTiming(1, { duration: SWAY_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    float.value = withRepeat(
      withTiming(1, { duration: FLOAT_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(breath);
      cancelAnimation(sway);
      cancelAnimation(float);
    };
  }, [breath, sway, float]);

  useEffect(() => {
    if (speaking) {
      talk.value = withRepeat(
        withSequence(
          withTiming(1.028, { duration: 190, easing: Easing.out(Easing.quad) }),
          withTiming(0.994, { duration: 240, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.017, { duration: 150, easing: Easing.out(Easing.quad) }),
          withTiming(1.0, { duration: 260, easing: Easing.inOut(Easing.quad) }),
          withDelay(120, withTiming(1.01, { duration: 180 })),
          withTiming(1.0, { duration: 220, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      );
      ringProgress.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
        -1,
      );
    } else {
      cancelAnimation(talk);
      cancelAnimation(ringProgress);
      talk.value = withTiming(1, { duration: 300 });
      ringProgress.value = withTiming(0, { duration: 300 });
    }
  }, [speaking, talk, ringProgress]);

  const breathingDepth = thinking ? 0.006 : 0.018;

  const avatarStyle = useAnimatedStyle(() => {
    const breathScale = 1 + breath.value * breathingDepth;
    return {
      transform: [
        { translateY: (float.value - 0.5) * -6 },
        { rotateZ: `${(sway.value - 0.5) * 1.2}deg` },
        { scale: breathScale * talk.value },
      ],
    };
  });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Ring progress={ringProgress} size={size} speaking={speaking} />
      <Animated.View style={avatarStyle}>
        <EveAvatar uri={uri} size={size} speaking={false} online={false} />
      </Animated.View>
    </View>
  );
}

function Ring({ progress, size, speaking }: { progress: SharedValue<number>; size: number; speaking: boolean }) {
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.35 }],
    opacity: speaking ? 0.45 * (1 - progress.value) : 0,
  }));

  return (
    <Animated.View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: theme.colors.primary[300] },
        ringStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 3 },
});
