import { Stack, useRouter } from "expo-router"
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import MemoListItem from "@/components/memo-list-item"
import { COLORS } from "@/constants/color"

export default function MemoListScreen() {
  const router = useRouter()

  return (
    <>
      <Stack.Screen
        options={{
          title: "メモ",
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push("/memo/new")}>
              <Text style={styles.addButton}>+</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        {/* ローディング表示 - コメントアウトを切り替えて表示/非表示を変更 */}
        {/* <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View> */}

        {/* 空状態表示 - コメントアウトを切り替えて表示/非表示を変更 */}
        {/* <EmptyView /> */}

        <ScrollView>
          <MemoListItem />
          <MemoListItem />
          <MemoListItem />
        </ScrollView>
      </SafeAreaView>
    </>
  )
}

// function EmptyView() {
//   return (
//     <View style={styles.emptyContainer}>
//       <Text style={styles.emptyIcon}>📝</Text>
//       <Text style={styles.emptyText}>メモがありません</Text>
//       <Text style={styles.emptySubText}>右上の＋から作成できます</Text>
//     </View>
//   );
// }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 12,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    fontSize: 26,
    color: COLORS.accent,
    fontWeight: "300",
    marginRight: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 120,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
    color: COLORS.subText,
    marginBottom: 4,
  },
  emptySubText: {
    fontSize: 14,
    color: COLORS.subText,
  },
})