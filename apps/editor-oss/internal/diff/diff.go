package diff

import "strings"

// UnifiedLines returns a simple unified diff with Git-style prefixes.
func UnifiedLines(before, after string) string {
	beforeLines := splitLines(before)
	afterLines := splitLines(after)

	dp := lcsMatrix(beforeLines, afterLines)

	var out []string
	i, j := 0, 0
	for i < len(beforeLines) && j < len(afterLines) {
		if beforeLines[i] == afterLines[j] {
			out = append(out, " "+beforeLines[i])
			i++
			j++
			continue
		}
		if dp[i+1][j] >= dp[i][j+1] {
			out = append(out, "-"+beforeLines[i])
			i++
		} else {
			out = append(out, "+"+afterLines[j])
			j++
		}
	}
	for i < len(beforeLines) {
		out = append(out, "-"+beforeLines[i])
		i++
	}
	for j < len(afterLines) {
		out = append(out, "+"+afterLines[j])
		j++
	}

	return strings.Join(out, "\n")
}

func splitLines(s string) []string {
	if s == "" {
		return []string{}
	}
	return strings.Split(s, "\n")
}

func lcsMatrix(a, b []string) [][]int {
	m := len(a)
	n := len(b)
	dp := make([][]int, m+1)
	for i := range dp {
		dp[i] = make([]int, n+1)
	}
	for i := m - 1; i >= 0; i-- {
		for j := n - 1; j >= 0; j-- {
			if a[i] == b[j] {
				dp[i][j] = dp[i+1][j+1] + 1
			} else if dp[i+1][j] >= dp[i][j+1] {
				dp[i][j] = dp[i+1][j]
			} else {
				dp[i][j] = dp[i][j+1]
			}
		}
	}
	return dp
}
