import { StyleSheet, Text, TouchableOpacity, View } from "react-native"

import { COLORS } from "@/constants/color"

export default function MemoListItem() {
  return (
    <TouchableOpacity style={styles.item}>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          買い物リスト
        </Text>
        <Text style={styles.itemDate}>2024/01/15</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    // Android elevation
    elevation: 4,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    color: COLORS.subText,
  },
  chevron: {
    fontSize: 18,
    color: COLORS.subText,
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 14,
    marginVertical: 6,
    marginRight: 16,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
})