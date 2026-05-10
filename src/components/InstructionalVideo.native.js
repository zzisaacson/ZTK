import { useVideoPlayer, VideoView } from "expo-video";
import { StyleSheet } from "react-native";

export default function InstructionalVideo() {
  const player = useVideoPlayer(require("../../assets/videos/Em_Instructional_Vid_720p.mp4"), (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000"
  }
});
