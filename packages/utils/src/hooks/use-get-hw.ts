const useGetHW = ({
	maxH,
	maxW,
	aspectRatio,
}: {
	maxH: number
	maxW: number
	aspectRatio: number
}) => {
	let calWidth = 0
	let calHeight = 0
	if (aspectRatio > maxW / maxH) {
		calHeight = maxW * (1 / aspectRatio)
		calWidth = maxW
	} else if (aspectRatio <= maxW / maxH) {
		calHeight = maxH
		calWidth = maxH * aspectRatio
	}
	return { width: calWidth, height: calHeight }
}

export default useGetHW
