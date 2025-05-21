import { useEffect, useRef } from "react"

const AudioVisualizer = ({ isPlaying }) => {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    const barCount = 40
    const barWidth = canvas.width / barCount

    const renderFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (isPlaying) {
        // Draw animated bars for the equalizer
        for (let i = 0; i < barCount; i++) {
          // Generate random heights for the bars to simulate audio visualization
          // In a real implementation, this would use actual audio data
          const height = isPlaying 
            ? Math.random() * canvas.height * 0.7 + canvas.height * 0.1 // Ensure minimum height
            : 0

          // Create gradient for bars - updated to maroon and gold
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - height)
          
          // Determine if we should use primary or accent color based on position
          if (i % 4 === 0) {
            // Gold accent bars (every 4th bar)
            gradient.addColorStop(0, "#f59e0b") // gold-500
            gradient.addColorStop(1, "#fbbf24") // gold-400
          } else {
            // Maroon primary bars
            gradient.addColorStop(0, "#8a2424") // maroon-700
            gradient.addColorStop(1, "#b83b3b") // maroon-600
          }
          
          ctx.fillStyle = gradient

          // Add some visual variety with different bar widths
          const variableBarWidth = barWidth - 2 - (i % 3 === 0 ? 1 : 0)
          
          // Draw the bar with rounded tops
          const x = i * barWidth
          const y = canvas.height - height
          const width = variableBarWidth
          
          ctx.beginPath()
          ctx.moveTo(x, canvas.height)
          ctx.lineTo(x, y + width / 2)
          ctx.arc(x + width / 2, y + width / 2, width / 2, Math.PI, 0, true)
          ctx.lineTo(x + width, canvas.height)
          ctx.closePath()
          ctx.fill()
        }
      } else {
        // Draw flat line with subtle gradient when not playing
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
        gradient.addColorStop(0, "#8a2424") // maroon-700
        gradient.addColorStop(0.5, "#d45a5a") // maroon-500
        gradient.addColorStop(1, "#8a2424") // maroon-700
        
        ctx.beginPath()
        ctx.moveTo(0, canvas.height / 2)
        ctx.lineTo(canvas.width, canvas.height / 2)
        ctx.strokeStyle = gradient
        ctx.lineWidth = 3
        ctx.stroke()
      }

      animationRef.current = requestAnimationFrame(renderFrame)
    }

    renderFrame()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying])

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={80} 
        className="w-full h-20 rounded-lg" 
      />
    </div>
  )
}

export default AudioVisualizer

