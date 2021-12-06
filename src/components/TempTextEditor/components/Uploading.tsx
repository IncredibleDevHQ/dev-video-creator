import React from 'react'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'

const Uploading = ({
  text = 'Uploading...',
  progress = 0,
}: {
  text?: string
  progress?: number
}) => {
  return (
    <div className="p-1 rounded flex shadow-md text-sm items-center bg-white">
      <div className="w-4 h-4 mr-2">
        <CircularProgressbar
          styles={buildStyles({
            rotation: 0.25,
            strokeLinecap: 'round',
            textSize: '12px',
            pathColor: `rgba(22, 163, 74, ${progress / 100})`,
            textColor: '#f88',
            trailColor: '#d6d6d6',
          })}
          value={progress}
        />
      </div>
      {text}
    </div>
  )
}

export default Uploading
