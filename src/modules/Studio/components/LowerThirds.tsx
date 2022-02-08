import Konva from 'konva'
import React, { useRef } from 'react'
import { Group, Image, Line, Rect, Text } from 'react-konva'
import useImage from 'use-image'
import IncredibleLogo from '../../../assets/incredible-x-logo.svg'
import useEdit from '../hooks/use-edit'

const CommonLowerThirds = ({
  x,
  y,
  userName,
  rectOneColors,
  rectTwoColors,
  rectThreeColors,
}: {
  x: number
  y: number
  userName: string
  rectOneColors: string[]
  rectTwoColors: string[]
  rectThreeColors: string[]
}) => {
  return (
    <>
      <Rect
        x={x}
        y={y}
        fillLinearGradientColorStops={[
          0,
          rectOneColors[0] || '#EE676D',
          1,
          rectOneColors[1] || '#CB56AF',
        ]}
        fillLinearGradientStartPoint={{ x, y }}
        fillLinearGradientEndPoint={{
          x: 200,
          y: 20,
        }}
        cornerRadius={8}
        width={0}
        height={40}
        ref={(ref) =>
          ref?.to({
            width: 300,
            duration: 0.3,
            easing: Konva.Easings.EaseOut,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  width: 0,
                  duration: 0.3,
                  easing: Konva.Easings.EaseOut,
                })
              }, 2800)
            },
          })
        }
      />
      <Rect
        x={x}
        y={y}
        fillLinearGradientColorStops={[
          0,
          rectTwoColors[0] || '#ffffff',
          1,
          rectTwoColors[1] || '#ffffff',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 200,
          y: 20,
        }}
        cornerRadius={8}
        width={0}
        height={40}
        key="secondRect"
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              width: 300,
              duration: 0.3,
              easing: Konva.Easings.EaseOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    width: 0,
                    duration: 0.3,
                    easing: Konva.Easings.EaseOut,
                  })
                }, 2400)
              },
            })
          }, 200)
        }
      />
      <Rect
        x={x}
        y={y}
        fillLinearGradientColorStops={[
          0,
          rectThreeColors[0] || '#0093E9',
          1,
          rectThreeColors[1] || '#80D0C7',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 200,
          y: 20,
        }}
        cornerRadius={8}
        width={0}
        height={40}
        key="thirdRect"
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              width: 300,
              duration: 0.3,
              easing: Konva.Easings.EaseOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    width: 0,
                    duration: 0.3,
                    easing: Konva.Easings.EaseOut,
                  })
                }, 2000)
              },
            })
          }, 400)
        }
      />
      <Text
        x={x + 10}
        y={y + 8}
        fill="#ffffff"
        text={userName}
        fontSize={24}
        opacity={0}
        key="username"
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.3,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    opacity: 0,
                    duration: 0.3,
                  })
                }, 2000)
              },
            })
          }, 400)
        }
      />
    </>
  )
}

export const GlassyLowerThirds = ({
  x,
  y,
  userName,
  logo,
  color,
  textColor,
}: {
  x: number
  y: number
  userName: string
  logo: string
  color: string
  textColor: string
}) => {
  const [image] = useImage(logo, 'anonymous')
  const { getTextWidth } = useEdit()
  const textWidth = useRef(getTextWidth(userName, 'Inter', 24, 'bold') + 80)

  if (logo)
    return (
      <>
        <Group x={x} y={y}>
          <Rect
            fill={color}
            fillLinearGradientColorStops={
              color === ''
                ? [0, '#7844CAC8', 0.92, '#db2887c8', 1, '#e32682c8']
                : []
            }
            fillLinearGradientStartPoint={
              color === ''
                ? {
                    x: 0,
                    y: 0,
                  }
                : {
                    x: 0,
                    y: 0,
                  }
            }
            fillLinearGradientEndPoint={
              color === ''
                ? {
                    x: 400,
                    y: 96,
                  }
                : {
                    x: 0,
                    y: 0,
                  }
            }
            cornerRadius={8}
            width={1}
            height={1}
            ref={(ref) => {
              ref?.to({
                offsetX: 48,
                offsetY: 48,
                height: 96,
                width: 96,
                duration: 0.5,
                easing: Konva.Easings.EaseOut,
                onFinish: () => {
                  setTimeout(() => {
                    ref?.to({
                      x: -Math.floor(textWidth.current),
                      width: Math.floor(textWidth.current) + 96,
                      duration: 0.3,
                      easing: Konva.Easings.BackEaseOut,
                      onFinish: () => {
                        setTimeout(() => {
                          ref?.to({
                            x: 0,
                            width: 96,
                            duration: 0.3,
                            easing: Konva.Easings.EaseOut,
                            onFinish: () => {
                              ref?.to({
                                offsetX: 0,
                                offsetY: 0,
                                height: 0,
                                width: 0,
                                duration: 0.2,
                              })
                            },
                          })
                        }, 2000)
                      },
                    })
                  }, 500)
                },
              })
            }}
          />
          {/* 18 is added to position the image in the center subtractiong 48 bcoz the rect's width is scaled to 96 and adding the half of the width and height to x and y respectively 
        bcoz the image has to scale from the center, so there would be a offset set, 
        on setting the offset the image moves negative, so to cancel that adding the offset values to x and y */}
          <Image
            x={18 - 48 + 30}
            y={18 - 48 + 30}
            width={0}
            height={0}
            image={image}
            opcaity={1}
            ref={(ref) => {
              ref?.to({
                offsetX: 30,
                offsetY: 30,
                width: 60,
                height: 60,
                duration: 0.5,
                easing: Konva.Easings.EaseOut,
                onFinish: () => {
                  setTimeout(() => {
                    ref?.to({
                      offsetX: 0,
                      offsetY: 0,
                      width: 0,
                      height: 0,
                      duration: 0.2,
                    })
                  }, 3100)
                },
              })
            }}
          />
          <Text
            x={-textWidth.current - 30}
            y={-48}
            fill={textColor || '#fafafa'}
            text={userName}
            fontSize={24}
            opacity={0}
            height={96}
            fontStyle="bold"
            fontFamily="Inter"
            key="username"
            verticalAlign="middle"
            ref={(ref) =>
              setTimeout(() => {
                ref?.to({
                  opacity: 1,
                  duration: 0.3,
                  onFinish: () => {
                    setTimeout(() => {
                      ref?.to({
                        opacity: 0,
                        duration: 0.3,
                      })
                    }, 1800)
                  },
                })
              }, 1100)
            }
          />
        </Group>
      </>
    )
  return (
    <>
      <Group x={x} y={y}>
        <Rect
          x={60}
          y={-30}
          fill={color}
          fillLinearGradientColorStops={[
            0,
            '#7844CAC8',
            0.92,
            '#db2887c8',
            1,
            '#e32682c8',
          ]}
          fillLinearGradientStartPoint={{
            x: 0,
            y: 0,
          }}
          fillLinearGradientEndPoint={{
            x: 400,
            y: 60,
          }}
          cornerRadius={8}
          width={0}
          height={60}
          ref={(ref) => {
            ref?.to({
              x: -Math.floor(textWidth.current) + 60,
              width: Math.floor(textWidth.current),
              duration: 0.3,
              easing: Konva.Easings.BackEaseOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    x: 0,
                    width: 0,
                    duration: 0.3,
                    easing: Konva.Easings.EaseOut,
                  })
                }, 2000)
              },
            })
          }}
        />
        <Text
          x={-textWidth.current + 80}
          y={-30}
          fill={textColor || '#fafafa'}
          text={userName}
          fontSize={24}
          opacity={0}
          height={60}
          fontStyle="bold"
          fontFamily="Inter"
          key="username"
          verticalAlign="middle"
          ref={(ref) =>
            setTimeout(() => {
              ref?.to({
                opacity: 1,
                duration: 0.3,
                onFinish: () => {
                  setTimeout(() => {
                    ref?.to({
                      opacity: 0,
                      duration: 0.3,
                    })
                  }, 1000)
                },
              })
            }, 300)
          }
        />
      </Group>
    </>
  )
}

export const PastelLinesLowerThirds = ({
  x,
  y,
  userName,
  logo,
  color,
  textColor,
}: {
  x: number
  y: number
  userName: string
  logo: string
  color: string
  textColor: string
}) => {
  const [image] = useImage(logo, 'anonymous')
  const { getTextWidth } = useEdit()
  const textWidth = useRef(getTextWidth(userName, 'Inter', 24, 'bold') + 80)
  if (logo)
    return (
      <>
        <Group x={x} y={y}>
          <Rect
            fill={color || '#E0D6ED'}
            width={0}
            height={96}
            stroke={textColor || '#27272A'}
            strokeWidth={1}
            ref={(ref) => {
              ref?.to({
                width: 96,
                duration: 0.5,
                easing: Konva.Easings.EaseOut,
                onFinish: () => {
                  setTimeout(() => {
                    ref?.to({
                      width: Math.floor(textWidth.current) + 96,
                      duration: 0.3,
                      easing: Konva.Easings.EaseOut,
                      onFinish: () => {
                        setTimeout(() => {
                          ref?.to({
                            width: 96,
                            duration: 0.3,
                            easing: Konva.Easings.EaseOut,
                            onFinish: () => {
                              ref?.to({
                                width: 0,
                                strokeWidth: 0,
                                duration: 0.3,
                              })
                            },
                          })
                        }, 2000)
                      },
                    })
                  }, 500)
                },
              })
            }}
          />
          <Line
            points={[96, 0, 96, 96]}
            stroke={textColor || '#27272A'}
            strokeWidth={1}
            opacity={0}
            ref={(ref) => {
              setTimeout(() => {
                ref?.to({
                  opacity: 1,
                  duration: 0.3,
                  onFinish: () => {
                    setTimeout(() => {
                      ref?.to({
                        opacity: 0,
                        duration: 0.1,
                      })
                    }, 2500)
                  },
                })
              }, 700)
            }}
          />
          {/* 18 is added, to position the image in the center 
        bcoz the image has to scale from the center, so there would be a offset set, 
        on setting the offset the image moves negative, so to cancel that adding the offset values to x and y */}
          <Image
            x={18 + 30}
            y={18 + 30}
            width={0}
            height={0}
            image={image}
            opcaity={1}
            ref={(ref) => {
              setTimeout(() => {
                ref?.to({
                  offsetX: 30,
                  offsetY: 30,
                  width: 60,
                  height: 60,
                  duration: 0.5,
                  easing: Konva.Easings.EaseOut,
                  onFinish: () => {
                    setTimeout(() => {
                      ref?.to({
                        offsetX: 0,
                        offsetY: 0,
                        width: 0,
                        height: 0,
                        duration: 0.1,
                      })
                    }, 3000)
                  },
                })
              }, 100)
            }}
          />
          <Text
            x={150}
            fill={textColor || '#27272A'}
            text={userName}
            fontSize={24}
            opacity={0}
            height={96}
            fontStyle="bold"
            fontFamily="Inter"
            key="username"
            verticalAlign="middle"
            ref={(ref) =>
              setTimeout(() => {
                ref?.to({
                  x: 108,
                  opacity: 1,
                  duration: 0.3,
                  onFinish: () => {
                    setTimeout(() => {
                      ref?.to({
                        opacity: 0,
                        duration: 0.3,
                      })
                    }, 1800)
                  },
                })
              }, 900)
            }
          />
        </Group>
      </>
    )
  return (
    <>
      <Group x={x} y={y}>
        <Rect
          fill={color || '#E0D6ED'}
          width={0}
          height={96}
          stroke={textColor || '#27272A'}
          strokeWidth={1}
          ref={(ref) => {
            ref?.to({
              width: Math.floor(textWidth.current) + 48,
              duration: 0.3,
              easing: Konva.Easings.EaseOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    width: 0,
                    strokeWidth: 0,
                    duration: 0.3,
                    easing: Konva.Easings.EaseOut,
                  })
                }, 2000)
              },
            })
          }}
        />
        <Text
          x={60}
          fill={textColor || '#27272A'}
          text={userName}
          fontSize={24}
          opacity={0}
          height={96}
          fontStyle="bold"
          fontFamily="Inter"
          key="username"
          verticalAlign="middle"
          ref={(ref) =>
            setTimeout(() => {
              ref?.to({
                x: 20,
                opacity: 1,
                duration: 0.3,
                onFinish: () => {
                  setTimeout(() => {
                    ref?.to({
                      opacity: 0,
                      duration: 0.3,
                    })
                  }, 1000)
                },
              })
            }, 100)
          }
        />
      </Group>
    </>
  )
}

export const IncredibleLowerThirds = ({
  x,
  y,
  displayName,
  username,
  width,
}: {
  x: number
  y: number
  displayName: string
  username: string
  width: number
}) => {
  const [incredibleLogo] = useImage(IncredibleLogo)

  return (
    <>
      <Rect
        x={x - width}
        y={y - 24}
        fill="#16A34A"
        cornerRadius={8}
        width={0}
        height={50}
        key="firstRect"
        ref={(ref) =>
          ref?.to({
            duration: 1.4,
            onFinish: () => {
              ref?.to({
                x: x - width + 25,
                width: width + 45,
                duration: 0.6,
                easing: Konva.Easings.EaseOut,
                onFinish: () => {
                  ref?.to({
                    duration: 3.1,
                    onFinish: () => {
                      ref?.to({
                        width: 0,
                        duration: 0.3,
                        easing: Konva.Easings.EaseOut,
                      })
                    },
                  })
                },
              })
            },
          })
        }
      />
      <Rect
        x={x - width + 10}
        y={y - 24}
        fill="#ffffff"
        cornerRadius={8}
        width={0}
        height={50}
        key="secondRect"
        ref={(ref) =>
          ref?.to({
            duration: 1.55,
            onFinish: () => {
              ref?.to({
                x: x - width + 15,
                width: width + 35,
                duration: 0.6,
                easing: Konva.Easings.EaseOut,
                onFinish: () => {
                  ref?.to({
                    duration: 2.9,
                    onFinish: () => {
                      ref?.to({
                        width: 0,
                        duration: 0.2,
                        easing: Konva.Easings.EaseOut,
                      })
                    },
                  })
                },
              })
            },
          })
        }
      />
      <Text
        x={x - width + 30}
        y={y - 9}
        fill="#1F2937"
        text={displayName}
        fontSize={20}
        fontFamily="'Inter'"
        fontStyle="normal 500"
        opacity={0}
        key="displayname"
        ref={(ref) =>
          ref?.to({
            duration: 2,
            onFinish: () => {
              ref?.to({
                opacity: 1,
                duration: 0.3,
                onFinish: () => {
                  ref?.to({
                    duration: 1,
                    onFinish: () => {
                      ref?.to({
                        opacity: 0,
                        duration: 0.3,
                      })
                    },
                  })
                },
              })
            },
          })
        }
      />
      <Text
        x={x - width + 30}
        y={y - 9}
        fill="#1F2937"
        text={username}
        fontSize={20}
        fontFamily="'Inter'"
        fontStyle="normal 500"
        opacity={0}
        key="username"
        ref={(ref) =>
          ref?.to({
            duration: 3.3,
            onFinish: () => {
              ref?.to({
                opacity: 1,
                duration: 0.3,
                onFinish: () => {
                  ref?.to({
                    duration: 1.2,
                    onFinish: () => {
                      ref?.to({
                        opacity: 0,
                        duration: 0.3,
                      })
                    },
                  })
                },
              })
            },
          })
        }
      />
      <Image
        image={incredibleLogo}
        x={x}
        y={y}
        width={1}
        height={1}
        offsetX={1 / 2}
        offsetY={1 / 2}
        ref={(ref) => {
          ref?.to({
            scaleX: 100,
            scaleY: 100,
            duration: 0.4,
            easing: Konva.Easings.EaseIn,
            onFinish: () => {
              ref?.to({
                scaleX: 48,
                scaleY: 48,
                duration: 0.4,
                easing: Konva.Easings.EaseOut,
              })
              ref?.to({
                duration: 0.2,
                onFinish: () => {
                  ref?.to({
                    x: x - width - 10,
                    duration: 1,
                    easing: Konva.Easings.StrongEaseInOut,
                  })
                  ref?.to({
                    duration: 0.8,
                    onFinish: () => {
                      ref?.to({
                        x: x - width - 20,
                        duration: 0.6,
                        onFinish: () => {
                          ref?.to({
                            duration: 3.25,
                            onFinish: () => {
                              ref?.to({
                                x,
                                duration: 0.3,
                                onFinish: () => {
                                  ref?.to({
                                    scaleX: 100,
                                    scaleY: 100,
                                    duration: 0.2,
                                    easing: Konva.Easings.EaseOut,
                                    onFinish: () => {
                                      ref?.to({
                                        scaleX: 0,
                                        scaleY: 0,
                                        duration: 0.2,
                                        easing: Konva.Easings.EaseIn,
                                      })
                                    },
                                  })
                                },
                              })
                            },
                          })
                        },
                      })
                    },
                  })
                },
              })
            },
          })
        }}
      />
    </>
  )
}

export const FragmentCard = ({
  x,
  y,
  fragmentTitle,
  rectOneColors,
  rectTwoColors,
  fragmentImage,
  fragmentImageDimensions,
}: {
  x: number
  y: number
  fragmentTitle: string
  rectOneColors: string[]
  rectTwoColors: string[]
  fragmentImage: HTMLImageElement | undefined
  fragmentImageDimensions: {
    width: number
    height: number
    x: number
    y: number
  }
}) => {
  return (
    <Group x={x} y={y}>
      <Rect
        x={15}
        y={15}
        width={400}
        height={350}
        fillLinearGradientColorStops={[
          0,
          rectOneColors[0] || '#EE676D',
          1,
          rectOneColors[0] || '#CB56AF',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 415,
          y: 365,
        }}
        opacity={0}
        ref={(ref) =>
          ref?.to({
            opacity: 1,
            duration: 0.2,
          })
        }
        cornerRadius={8}
      />
      <Rect
        x={0}
        y={0}
        width={400}
        height={0}
        fillLinearGradientColorStops={[
          0,
          rectTwoColors[0] || '#ffffff',
          1,
          rectTwoColors[1] || '#ffffff',
        ]}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{
          x: 400,
          y: 350,
        }}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              height: 350,
              duration: 0.3,
            })
          }, 200)
        }
        cornerRadius={8}
      />
      <Text
        x={20}
        y={25}
        text={fragmentTitle}
        fill="#4B5563"
        fontSize={36}
        fontFamily="Roboto"
        fontStyle="normal 400"
        align="left"
        width={350}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.3,
            })
          }, 600)
        }
      />
      <Image
        x={fragmentImageDimensions.x}
        y={fragmentImageDimensions.y}
        width={fragmentImageDimensions.width}
        height={fragmentImageDimensions.height}
        image={fragmentImage}
        opacity={0}
        ref={(ref) =>
          setTimeout(() => {
            ref?.to({
              opacity: 1,
              duration: 0.3,
            })
          }, 600)
        }
      />
    </Group>
  )
}

export default CommonLowerThirds
