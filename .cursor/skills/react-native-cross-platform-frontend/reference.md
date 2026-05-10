# React Native Cross-Platform Frontend Reference

## Practical Skill Checklist

### Platform Foundation

- Expo runtime model and config (`app.json`, platform options).
- React Native core primitives and styling constraints.
- React Native Web compatibility patterns.

### UI Professionalization

- Design tokens and component primitives.
- Screen composition patterns (header/content/footer/timeline).
- Empty/loading/error/skeleton state design.

### Performance

- Thread model awareness (JS/UI/native).
- FlatList virtualization and batching tuning.
- Render minimization (`memo`, stable props, derived state).

### Motion

- Reanimated shared values/worklets.
- Gesture-driven interactions and transition choreography.
- Consistent motion system (durations/easing/feedback).

### Navigation + URL strategy

- React Navigation nested navigator design.
- Deep linking for native and URL mapping for web.
- Link semantics for browser behavior.

### Accessibility + Input

- Screen reader labels and roles.
- Focus management and keyboard support on web.
- Touch target sizing and visual contrast.

## Suggested Library Set For This App

- `@react-navigation/native` and platform navigator packages.
- `react-native-reanimated` and `react-native-gesture-handler`.
- `react-native-safe-area-context`.
- `expo-av` or current Expo audio stack for metronome/audio cues.
- Optional: `@shopify/react-native-skia` for high-FPS custom notation lanes.

## Verification Routine Per Feature

1. Validate behavior on iOS, Android, and web.
2. Confirm no obvious jank in the main interaction loop.
3. Confirm deep links and back navigation behavior.
4. Confirm keyboard/focus behavior on web.
5. Confirm accessibility labels and scoring feedback clarity.

## Source Links

- https://docs.expo.dev/workflow/web
- https://reactnative.dev/docs/performance
- https://reactnative.dev/docs/optimizing-flatlist-configuration
- https://reactnavigation.org/docs/deep-linking
- https://reactnavigation.org/docs/configuring-links
- https://docs.swmansion.com/react-native-reanimated/docs/guides/performance
- https://docs.swmansion.com/react-native-reanimated/docs/guides/worklets
