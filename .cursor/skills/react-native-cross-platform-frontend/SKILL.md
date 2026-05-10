---
name: react-native-cross-platform-frontend
description: Build professional React Native + Expo frontend features that work on iOS, Android, and web. Use when implementing cross-platform UI architecture, navigation, performance optimization, animations, responsive layouts, or web compatibility in Expo apps.
disable-model-invocation: true
---

# React Native Cross-Platform Frontend

## Use This Skill For

- Expo apps that must ship on iOS, Android, and web.
- UI-heavy features with performance and animation requirements.
- Professionalization passes (design system, accessibility, consistency).
- New screens/flows that need architecture and quality guardrails.

## Default Stack And Priorities

1. Use TypeScript for all new frontend modules.
2. Build a reusable design system before feature-specific styling.
3. Keep navigation/linking consistent across native and web.
4. Use Reanimated for high-frequency animations.
5. Profile and optimize for 60 FPS before visual polish.

## Cross-Platform Implementation Rules

### 1) Architecture

- Organize by feature (`features/song`, `features/lesson`, `features/scoring`) with shared primitives in `components/ui`.
- Separate pure domain logic (timing/scoring/normalization) from React UI code.
- Keep platform-specific code isolated (`.native.ts`, `.web.ts`) only when required.

### 2) UI And Design System

- Define design tokens once: color, spacing, typography, radius, elevation.
- Build composable primitives (`Button`, `Card`, `Text`, `Screen`, `Section`).
- Reuse the same spacing and type scale across all screens.

### 3) Navigation And Linking

- Configure React Navigation linking for both native deep links and web URLs.
- Use `Link` or `useLinkProps` when rendering web-navigable elements.
- Keep route names and URL path config synchronized.

### 4) Performance Baseline

- Assume 16.67ms/frame budget and avoid JS-thread blocking work in render paths.
- For long lists, tune `FlatList` (`initialNumToRender`, `windowSize`, batching props) and memoize list items.
- Move expensive transforms out of component render and into selectors/utilities.

### 5) Animation And Motion

- Prefer Reanimated shared values/worklets for smooth timeline and note-scroll UI.
- Avoid capturing large objects in worklets; capture scalars/small values only.
- Keep motion durations/easing consistent across screens.

### 6) Web Compatibility

- Verify every new screen on mobile and web before completion.
- Use RN primitives first (`View`, `Text`, `Pressable`) for maximum parity.
- Validate keyboard/mouse behavior on web (focus, hover, links, shortcuts).

### 7) Accessibility

- Add roles/labels/hints for controls and game feedback.
- Ensure touch targets are comfortably sized.
- Check contrast for all timing/scoring indicators.

## Definition Of Done (Frontend)

- Works on iOS, Android, and web.
- No obvious dropped-frame/jank during core interactions.
- Navigation and deep links behave correctly on native and web.
- Core UI components come from shared design system primitives.
- Accessibility checks pass for labels, targets, and contrast.

## Sources

- Expo web workflow docs: https://docs.expo.dev/workflow/web
- React Native performance overview: https://reactnative.dev/docs/performance
- React Native FlatList optimization: https://reactnative.dev/docs/optimizing-flatlist-configuration
- React Navigation deep linking/config: https://reactnavigation.org/docs/deep-linking
- React Navigation linking config: https://reactnavigation.org/docs/configuring-links
- React Native Reanimated performance/worklets: https://docs.swmansion.com/react-native-reanimated/docs/guides/performance
- React Native Reanimated worklets: https://docs.swmansion.com/react-native-reanimated/docs/guides/worklets
