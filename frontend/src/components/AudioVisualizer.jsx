"use client"

import { useEffect, useRef } from "react"

const AudioVisualizer = ({ isPlaying }) => {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    const barCount = 30
    const barWidth = canvas.width / barCount

    const renderFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (isPlaying) {
        // Draw animated bars for the equalizer
        for (let i = 0; i < barCount; i++) {
          // Generate random heights for the bars to simulate audio visualization
          // In a real implementation, this would use actual audio data
          const height = isPlaying ? Math.random() * canvas.height * 0.8 : 0

          // Create gradient for bars - updated to maroon and yellow
          const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - height)
          gradient.addColorStop(0, "#8a2424") // maroon-700
          gradient.addColorStop(1, "#f59e0b") // yellow-500

          ctx.fillStyle = gradient

          // Draw the bar
          ctx.fillRect(i * barWidth, canvas.height - height, barWidth - 2, height)
        }
      } else {
        // Draw flat line when not playing
        ctx.beginPath()
        ctx.moveTo(0, canvas.height / 2)
        ctx.lineTo(canvas.width, canvas.height / 2)
        ctx.strokeStyle = "#6b7280" // gray-500
        ctx.lineWidth = 2
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

  return <canvas ref={canvasRef} width={600} height={80} className="w-full h-20 rounded-lg" />
}

export default AudioVisualizer

