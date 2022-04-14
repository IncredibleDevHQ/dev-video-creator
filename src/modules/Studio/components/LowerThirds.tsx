import Konva from 'konva'
import React, { useRef } from 'react'
import { Group, Image, Line, Rect, Text } from 'react-konva'
import useImage from 'use-image'
import IncredibleLogo from '../../../assets/incredible-x-logo.svg'
import { TopLayerChildren } from '../../../utils/configTypes'
import { BrandingJSON } from '../../Branding/BrandingPage'
import useEdit from '../hooks/use-edit'
import { getCanvasGradient } from '../utils/StudioUserConfig'

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
  designation,
  organization,
  logo,
  color,
  textColor,
  branding,
  setTopLayerChildren,
}: {
  x: number
  y: number
  userName: string
  designation: string
  organization: string
  logo: string
  color: string
  textColor: string
  branding: BrandingJSON | null | undefined
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
}) => {
  const [image] = useImage(logo, 'anonymous')
  const { getTextWidth } = useEdit()
  const rectWidth =
    Math.max(
      getTextWidth(`${designation}, ${organization}`, 'Gilroy', 16, 'normal'),
      getTextWidth(userName || '', 'Gilroy', 24, 'bold')
    ) +
    16 +
    8

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
                    y: 80,
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
                duration: 0.4,
                easing: Konva.Easings.BackEaseOut,
                onFinish: () => {
                  setTimeout(() => {
                    ref?.to({
                      x: -Math.floor(rectWidth),
                      width: Math.floor(rectWidth) + 96,
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
                              setTimeout(() => {
                                ref?.to({
                                  offsetX: 0,
                                  offsetY: 0,
                                  height: 0,
                                  width: 0,
                                  duration: 0.4,
                                  easing: Konva.Easings.BackEaseIn,
                                  onFinish: () => {
                                    setTimeout(() => {
                                      setTopLayerChildren?.({
                                        id: '',
                                        state: '',
                                      })
                                    }, 400)
                                  },
                                })
                              }, 200)
                            },
                          })
                        }, 2000)
                      },
                    })
                  }, 800)
                },
              })
            }}
          />
          {/* 20 is added to position the image in the center, subtractiong 48 bcoz the rect's width is scaled to 96 and adding the half of the width and height to x and y respectively 
        bcoz the image has to scale from the center, so there would be a offset set, 
        on setting the offset the image moves negative, so to cancel that adding the offset values to x and y */}
          <Image
            x={20 - 48 + 28}
            y={20 - 48 + 28}
            width={0}
            height={0}
            image={image}
            opcaity={1}
            ref={(ref) => {
              ref?.to({
                offsetX: 28,
                offsetY: 28,
                width: 56,
                height: 56,
                duration: 0.1,
                easing: Konva.Easings.BackEaseOut,
                onFinish: () => {
                  setTimeout(() => {
                    ref?.to({
                      offsetX: 0,
                      offsetY: 0,
                      width: 0,
                      height: 0,
                      duration: 0.4,
                    })
                  }, 3450)
                },
              })
            }}
          />
          <Text
            x={-rectWidth - 24}
            y={designation === '' && organization === '' ? -48 : -24}
            fill={textColor || '#fafafa'}
            text={userName}
            fontSize={24}
            opacity={0}
            height={96}
            verticalAlign={
              designation === '' && organization === '' ? 'middle' : undefined
            }
            fontStyle="bold"
            fontFamily={branding?.font?.body?.family || 'Gilroy'}
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
                    }, 1500)
                  },
                })
              }, 1500)
            }
          />
          {designation !== '' && organization === '' && (
            <Text
              x={-rectWidth - 24}
              y={8}
              fill={textColor || '#fafafa'}
              text={designation}
              fontSize={16}
              opacity={0}
              height={96}
              fontFamily={branding?.font?.body?.family || 'Gilroy'}
              key="designation"
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
                      }, 1500)
                    },
                  })
                }, 1500)
              }
            />
          )}
          {designation === '' && organization !== '' && (
            <Text
              x={-rectWidth - 24}
              y={8}
              fill={textColor || '#fafafa'}
              text={organization}
              fontSize={16}
              opacity={0}
              height={96}
              fontFamily={branding?.font?.body?.family || 'Gilroy'}
              key="organization"
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
                      }, 1500)
                    },
                  })
                }, 1500)
              }
            />
          )}
          {designation !== '' && organization !== '' && (
            <Text
              x={-rectWidth - 24}
              y={8}
              fill={textColor || '#fafafa'}
              text={`${designation}, ${organization}`}
              fontSize={16}
              opacity={0}
              height={96}
              fontFamily={branding?.font?.body?.family || 'Gilroy'}
              key="designationAndOrganization"
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
                      }, 1500)
                    },
                  })
                }, 1500)
              }
            />
          )}
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
              x: -Math.floor(rectWidth) - 32 + 60,
              width: Math.floor(rectWidth) + 32,
              duration: 0.3,
              easing: Konva.Easings.BackEaseOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    x: 60,
                    width: 0,
                    duration: 0.3,
                    easing: Konva.Easings.EaseOut,
                    onFinish: () => {
                      setTimeout(() => {
                        setTopLayerChildren?.({
                          id: '',
                          state: '',
                        })
                      }, 400)
                    },
                  })
                }, 2000)
              },
            })
          }}
        />
        <Text
          x={-rectWidth - 16 + 60}
          y={designation === '' && organization === '' ? -30 : -20}
          fill={textColor || '#fafafa'}
          text={userName}
          fontSize={24}
          opacity={0}
          height={60}
          fontStyle="bold"
          fontFamily={branding?.font?.body?.family || 'Gilroy'}
          verticalAlign={
            designation === '' && organization === '' ? 'middle' : undefined
          }
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
                  }, 1400)
                },
              })
            }, 300)
          }
        />
        {designation !== '' && organization === '' && (
          <Text
            x={-rectWidth - 16 + 60}
            y={6}
            fill={textColor || '#fafafa'}
            text={designation}
            fontSize={16}
            opacity={0}
            height={60}
            fontStyle="bold"
            fontFamily={branding?.font?.body?.family || 'Gilroy'}
            key="designation"
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
                    }, 1400)
                  },
                })
              }, 300)
            }
          />
        )}
        {designation === '' && organization !== '' && (
          <Text
            x={-rectWidth - 16 + 60}
            y={6}
            fill={textColor || '#fafafa'}
            text={organization}
            fontSize={16}
            opacity={0}
            height={60}
            fontStyle="bold"
            fontFamily={branding?.font?.body?.family || 'Gilroy'}
            key="organization"
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
                    }, 1400)
                  },
                })
              }, 300)
            }
          />
        )}
        {designation !== '' && organization !== '' && (
          <Text
            x={-rectWidth - 16 + 60}
            y={6}
            fill={textColor || '#fafafa'}
            text={`${designation}, ${organization}`}
            fontSize={16}
            opacity={0}
            height={60}
            fontStyle="bold"
            fontFamily={branding?.font?.body?.family || 'Gilroy'}
            key="designationAndOrganization"
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
                    }, 1400)
                  },
                })
              }, 300)
            }
          />
        )}
      </Group>
    </>
  )
}

export const PastelLinesLowerThirds = ({
  x,
  y,
  userName,
  designation,
  organization,
  logo,
  color,
  textColor,
  setTopLayerChildren,
}: {
  x: number
  y: number
  userName: string
  designation: string
  organization: string
  logo: string
  color: string
  textColor: string
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
}) => {
  const [image] = useImage(logo, 'anonymous')
  const { getTextWidth } = useEdit()
  const rectWidth = useRef(
    Math.max(
      getTextWidth(`${designation}, ${organization}`, 'Outfit', 16, 'normal'),
      getTextWidth(userName || '', 'Outfit', 24, 'bold')
    ) + 50
  )
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
                      width: Math.floor(rectWidth.current) + 96,
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
                                onFinish: () => {
                                  setTimeout(() => {
                                    setTopLayerChildren?.({
                                      id: '',
                                      state: '',
                                    })
                                  }, 400)
                                },
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
          {/* 18 is added to position the image in the center and 30 is added 
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
            y={designation === '' && organization === '' ? 0 : 24}
            fill={textColor || '#27272A'}
            text={userName}
            fontSize={24}
            opacity={0}
            height={96}
            fontStyle="bold"
            fontFamily="Outfit"
            verticalAlign={
              designation === '' && organization === '' ? 'middle' : undefined
            }
            key="username"
            ref={(ref) =>
              setTimeout(() => {
                ref?.to({
                  x: 118,
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
          {designation !== '' && organization === '' && (
            <Text
              x={150}
              y={56}
              fill={textColor || '#27272A'}
              text={designation}
              fontSize={16}
              opacity={0}
              height={96}
              fontFamily="Outfit"
              key="designation"
              ref={(ref) =>
                setTimeout(() => {
                  ref?.to({
                    x: 118,
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
          )}
          {designation === '' && organization !== '' && (
            <Text
              x={150}
              y={56}
              fill={textColor || '#27272A'}
              text={organization}
              fontSize={16}
              opacity={0}
              height={96}
              fontFamily="Outfit"
              key="organization"
              ref={(ref) =>
                setTimeout(() => {
                  ref?.to({
                    x: 118,
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
          )}
          {designation !== '' && organization !== '' && (
            <Text
              x={150}
              y={56}
              fill={textColor || '#27272A'}
              text={`${designation}, ${organization}`}
              fontSize={16}
              opacity={0}
              height={96}
              fontFamily="Outfit"
              key="designationAndOrganization"
              ref={(ref) =>
                setTimeout(() => {
                  ref?.to({
                    x: 118,
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
          )}
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
              width: Math.floor(rectWidth.current),
              duration: 0.3,
              easing: Konva.Easings.EaseOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    width: 0,
                    strokeWidth: 0,
                    duration: 0.3,
                    easing: Konva.Easings.EaseOut,
                    onFinish: () => {
                      setTimeout(() => {
                        setTopLayerChildren?.({
                          id: '',
                          state: '',
                        })
                      }, 400)
                    },
                  })
                }, 1300)
              },
            })
          }}
        />
        <Text
          x={60}
          y={designation === '' && organization === '' ? 0 : 24}
          fill={textColor || '#27272A'}
          text={userName}
          fontSize={24}
          opacity={0}
          height={96}
          fontStyle="bold"
          fontFamily="Outfit"
          verticalAlign={
            designation === '' && organization === '' ? 'middle' : undefined
          }
          key="username"
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
        {designation !== '' && organization === '' && (
          <Text
            x={60}
            y={56}
            fill={textColor || '#27272A'}
            text={designation}
            fontSize={16}
            opacity={0}
            height={96}
            fontFamily="Outfit"
            key="designation"
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
        )}
        {designation === '' && organization !== '' && (
          <Text
            x={60}
            y={56}
            fill={textColor || '#27272A'}
            text={organization}
            fontSize={16}
            opacity={0}
            height={96}
            fontFamily="Outfit"
            key="organization"
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
        )}
        {designation !== '' && organization !== '' && (
          <Text
            x={60}
            y={56}
            fill={textColor || '#27272A'}
            text={`${designation}, ${organization}`}
            fontSize={16}
            opacity={0}
            height={96}
            fontFamily="Outfit"
            key="designationAndOrganization"
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
        )}
      </Group>
    </>
  )
}

export const CassidooLowerThirds = ({
  x,
  y,
  userName,
  designation,
  organization,
  logo,
  color,
  textColor,
  setTopLayerChildren,
}: {
  x: number
  y: number
  userName: string
  designation: string
  organization: string
  logo: string
  color: string
  textColor: string
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
}) => {
  const [image] = useImage(logo, 'anonymous')
  const { getTextWidth } = useEdit()

  const rectWidth =
    Math.max(
      getTextWidth(
        `${designation}, ${organization}`,
        'Roboto Mono',
        16,
        'normal'
      ),
      getTextWidth(userName || '', 'Roboto Mono', 24, 'bold')
    ) + 20
  if (logo)
    return (
      <>
        <Group
          x={x}
          y={y}
          opacity={0}
          ref={(ref) => {
            ref?.to({
              opacity: 1,
              duration: 0.6,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    opacity: 0,
                    duration: 0.6,
                    onFinish: () => {
                      setTimeout(() => {
                        setTopLayerChildren?.({
                          id: '',
                          state: '',
                        })
                      }, 400)
                    },
                  })
                }, 2000)
              },
            })
          }}
        >
          <Rect
            fill={color || '#E0D6ED'}
            width={Math.floor(rectWidth) + 96}
            height={96}
            opacity={0.8}
            cornerRadius={16}
            stroke={getCanvasGradient(
              [
                { color: '#E9BC3F', offset: 0.0 },
                { color: '#EB4888', offset: 0.5469 },
                { color: '#10A2F5', offset: 1.0 },
              ],
              {
                x0: 0,
                y0: 40,
                x1: Math.floor(rectWidth),
                y1: 96,
              }
            )}
            strokeWidth={3}
          />
          <Image x={18} y={18} width={60} height={60} image={image} />
          <Text
            x={98}
            y={designation === '' && organization === '' ? 0 : 24}
            fill={textColor || '#27272A'}
            text={userName}
            fontSize={24}
            height={96}
            fontStyle="bold"
            fontFamily="Roboto Mono"
            verticalAlign={
              designation === '' && organization === '' ? 'middle' : undefined
            }
            key="username"
          />
          {designation !== '' && organization === '' && (
            <Text
              x={98}
              y={60}
              fill={textColor || '#27272A'}
              text={designation}
              fontSize={16}
              height={96}
              fontFamily="Roboto Mono"
              key="designation"
            />
          )}
          {designation === '' && organization !== '' && (
            <Text
              x={98}
              y={60}
              fill={textColor || '#27272A'}
              text={organization}
              fontSize={16}
              height={96}
              fontFamily="Roboto Mono"
              key="organization"
            />
          )}
          {designation !== '' && organization !== '' && (
            <Text
              x={98}
              y={60}
              fill={textColor || '#27272A'}
              text={`${designation}, ${organization}`}
              fontSize={16}
              height={96}
              fontFamily="Roboto Mono"
              key="designationAndOrganization"
            />
          )}
        </Group>
      </>
    )
  return (
    <>
      <Group
        x={x}
        y={y}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            opacity: 1,
            duration: 0.6,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  opacity: 0,
                  duration: 0.6,
                  onFinish: () => {
                    setTimeout(() => {
                      setTopLayerChildren?.({
                        id: '',
                        state: '',
                      })
                    }, 400)
                  },
                })
              }, 2000)
            },
          })
        }}
      >
        <Rect
          fill={color || '#E0D6ED'}
          width={Math.floor(rectWidth) + 48}
          height={96}
          opacity={0.8}
          cornerRadius={16}
          stroke={getCanvasGradient(
            [
              { color: '#E9BC3F', offset: 0.0 },
              { color: '#EB4888', offset: 0.5469 },
              { color: '#10A2F5', offset: 1.0 },
            ],
            {
              x0: 0,
              y0: 40,
              x1: Math.floor(rectWidth),
              y1: 96,
            }
          )}
          strokeWidth={3}
        />
        <Text
          x={20}
          y={designation === '' && organization === '' ? 0 : 24}
          fill={textColor || '#27272A'}
          text={userName}
          fontSize={24}
          height={96}
          fontStyle="bold"
          fontFamily="Roboto Mono"
          verticalAlign={
            designation === '' && organization === '' ? 'middle' : undefined
          }
          key="username"
        />
        {designation !== '' && organization === '' && (
          <Text
            x={20}
            y={60}
            fill={textColor || '#27272A'}
            text={designation}
            fontSize={16}
            height={96}
            fontFamily="Roboto Mono"
            key="designation"
          />
        )}
        {designation === '' && organization !== '' && (
          <Text
            x={20}
            y={60}
            fill={textColor || '#27272A'}
            text={organization}
            fontSize={16}
            height={96}
            fontFamily="Roboto Mono"
            key="organization"
          />
        )}
        {designation !== '' && organization !== '' && (
          <Text
            x={20}
            y={60}
            fill={textColor || '#27272A'}
            text={`${designation}, ${organization}`}
            fontSize={16}
            height={96}
            fontFamily="Roboto Mono"
            key="designationAndOrganization"
          />
        )}
      </Group>
    </>
  )
}

export const LambdaTestLowerThirds = ({
  x,
  y,
  userName,
  designation,
  organization,
  logo,
  color,
  textColor,
  setTopLayerChildren,
}: {
  x: number
  y: number
  userName: string
  designation: string
  organization: string
  logo: string
  color: string
  textColor: string
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
}) => {
  const [image] = useImage(logo, 'anonymous')
  const { getTextWidth } = useEdit()

  const userNameWidth =
    getTextWidth(userName || '', 'Gilroy', 18, 'bold') + 16 + 16
  const userInfoWidth =
    getTextWidth(`${designation}, ${organization}`, 'Inter', 12, 'normal') +
    16 +
    16

  return (
    <>
      <Group x={x} y={y}>
        <Rect
          width={0}
          height={0}
          fill={color || '#ffffff'}
          cornerRadius={4}
          ref={(ref) => {
            ref?.to({
              width: logo ? userNameWidth + 40 + 16 : userNameWidth + 16,
              height: 56,
              duration: 0.3,
              easing: Konva.Easings.EaseInOut,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    width: 0,
                    height: 0,
                    duration: 0.3,
                    easing: Konva.Easings.EaseOut,
                    onFinish: () => {
                      setTimeout(() => {
                        setTopLayerChildren?.({
                          id: '',
                          state: '',
                        })
                      }, 400)
                    },
                  })
                }, 2600)
              },
            })
          }}
        />
        <Text
          x={16}
          y={0}
          fill={textColor || '#27272A'}
          text={userName}
          fontSize={18}
          opacity={0}
          height={56}
          fontStyle="bold"
          fontFamily="Gilroy"
          verticalAlign="middle"
          key="username"
          ref={(ref) => {
            setTimeout(() => {
              ref?.to({
                opacity: 1,
                duration: 0.3,
                onFinish: () => {
                  setTimeout(() => {
                    ref?.to({
                      opacity: 0,
                      duration: 0.2,
                      easing: Konva.Easings.EaseOut,
                    })
                  }, 2400)
                },
              })
            }, 200)
          }}
        />
        <Image
          x={userNameWidth}
          y={8}
          width={40}
          height={40}
          image={image}
          opcaity={0}
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
                  }, 2300)
                },
              })
            }, 200)
          }}
        />
        <Group y={60}>
          {designation !== '' && organization === '' && (
            <>
              <Rect
                width={0}
                height={32}
                fill="#4B5563"
                cornerRadius={4}
                ref={(ref) => {
                  setTimeout(() => {
                    ref?.to({
                      width: userInfoWidth,
                      duration: 0.2,
                      easing: Konva.Easings.EaseInOut,
                      onFinish: () => {
                        setTimeout(() => {
                          ref?.to({
                            width: 0,
                            duration: 0.3,
                            easing: Konva.Easings.EaseOut,
                          })
                        }, 2200)
                      },
                    })
                  }, 500)
                }}
              />
              <Text
                x={16}
                fill="#ffffff"
                text={designation}
                fontSize={12}
                opacity={0}
                height={32}
                verticalAlign="middle"
                fontFamily="Inter"
                key="designation"
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
                            easing: Konva.Easings.EaseOut,
                          })
                        }, 2000)
                      },
                    })
                  }, 600)
                }}
              />
            </>
          )}
          {designation === '' && organization !== '' && (
            <>
              <Rect
                width={0}
                height={32}
                fill="#4B5563"
                cornerRadius={4}
                ref={(ref) => {
                  setTimeout(() => {
                    ref?.to({
                      width: userInfoWidth,
                      duration: 0.2,
                      easing: Konva.Easings.EaseInOut,
                      onFinish: () => {
                        setTimeout(() => {
                          ref?.to({
                            width: 0,
                            duration: 0.3,
                            easing: Konva.Easings.EaseOut,
                          })
                        }, 2200)
                      },
                    })
                  }, 500)
                }}
              />
              <Text
                x={16}
                fill="#ffffff"
                text={organization}
                fontSize={12}
                opacity={0}
                height={32}
                verticalAlign="middle"
                fontFamily="Inter"
                key="organization"
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
                            easing: Konva.Easings.EaseOut,
                          })
                        }, 2000)
                      },
                    })
                  }, 600)
                }}
              />
            </>
          )}
          {designation !== '' && organization !== '' && (
            <>
              <Rect
                width={0}
                height={32}
                fill="#4B5563"
                cornerRadius={4}
                ref={(ref) => {
                  setTimeout(() => {
                    ref?.to({
                      width: userInfoWidth,
                      duration: 0.2,
                      easing: Konva.Easings.EaseInOut,
                      onFinish: () => {
                        setTimeout(() => {
                          ref?.to({
                            width: 0,
                            duration: 0.3,
                            easing: Konva.Easings.EaseOut,
                          })
                        }, 2200)
                      },
                    })
                  }, 500)
                }}
              />
              <Text
                x={16}
                fill="#ffffff"
                text={`${designation}, ${organization}`}
                fontSize={12}
                opacity={0}
                height={32}
                verticalAlign="middle"
                fontFamily="Inter"
                key="designationAndOrganization"
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
                            easing: Konva.Easings.EaseOut,
                          })
                        }, 2000)
                      },
                    })
                  }, 600)
                }}
              />
            </>
          )}
        </Group>
      </Group>
    </>
  )
}

export const LeeRobLowerThirds = ({
  x,
  y,
  userName,
  designation,
  organization,
  logo,
  color,
  textColor,
  setTopLayerChildren,
}: {
  x: number
  y: number
  userName: string
  designation: string
  organization: string
  logo: string
  color: string
  textColor: string
  setTopLayerChildren?: React.Dispatch<
    React.SetStateAction<{ id: string; state: TopLayerChildren }>
  >
}) => {
  const [image] = useImage(logo, 'anonymous')
  const { getTextWidth } = useEdit()

  const rectWidth =
    Math.max(
      getTextWidth(`${designation}, ${organization}`, 'Inter', 12, 'normal'),
      getTextWidth(userName || '', 'Inter', 18, 'bold')
    ) + 20
  if (logo)
    return (
      <>
        <Group
          x={x}
          y={y}
          opacity={0}
          ref={(ref) => {
            ref?.to({
              opacity: 1,
              duration: 0.6,
              onFinish: () => {
                setTimeout(() => {
                  ref?.to({
                    opacity: 0,
                    duration: 0.6,
                    onFinish: () => {
                      setTimeout(() => {
                        setTopLayerChildren?.({
                          id: '',
                          state: '',
                        })
                      }, 400)
                    },
                  })
                }, 2000)
              },
            })
          }}
        >
          <Rect
            fill={color || '#111827'}
            width={Math.floor(rectWidth) + 72}
            height={86}
            opacity={0.9}
            stroke={getCanvasGradient(
              [
                { color: '#DB1685', offset: 0.0 },
                { color: '#8165D6', offset: 0.5208 },
                { color: '#48A8F6', offset: 0.9583 },
              ],
              {
                x0: 0,
                y0: 0,
                x1: Math.floor(rectWidth) + 72,
                y1: 86,
              }
            )}
            strokeWidth={2}
          />
          <Image
            x={Math.floor(rectWidth) + 22}
            y={25}
            width={36}
            height={36}
            image={image}
          />
          <Text
            x={22}
            y={designation === '' && organization === '' ? 0 : 26}
            fill={textColor || '#ffffff'}
            text={userName}
            fontSize={18}
            height={86}
            fontStyle="bold"
            fontFamily="Inter"
            verticalAlign={
              designation === '' && organization === '' ? 'middle' : undefined
            }
            key="username"
          />
          {designation !== '' && organization === '' && (
            <Text
              x={22}
              y={52}
              fill={textColor || '#E5E7EB'}
              text={designation}
              fontSize={12}
              height={86}
              fontFamily="Inter"
              key="designation"
            />
          )}
          {designation === '' && organization !== '' && (
            <Text
              x={22}
              y={52}
              fill={textColor || '#E5E7EB'}
              text={organization}
              fontSize={12}
              height={86}
              fontFamily="Inter"
              key="organization"
            />
          )}
          {designation !== '' && organization !== '' && (
            <Text
              x={22}
              y={52}
              fill={textColor || '#E5E7EB'}
              text={`${designation}, ${organization}`}
              fontSize={12}
              height={86}
              fontFamily="Inter"
              key="designationAndOrganization"
            />
          )}
        </Group>
      </>
    )
  return (
    <>
      <Group
        x={x}
        y={y}
        opacity={0}
        ref={(ref) => {
          ref?.to({
            opacity: 1,
            duration: 0.6,
            onFinish: () => {
              setTimeout(() => {
                ref?.to({
                  opacity: 0,
                  duration: 0.6,
                  onFinish: () => {
                    setTimeout(() => {
                      setTopLayerChildren?.({
                        id: '',
                        state: '',
                      })
                    }, 400)
                  },
                })
              }, 2000)
            },
          })
        }}
      >
        <Rect
          fill={color || '#111827'}
          width={Math.floor(rectWidth) + 40}
          height={86}
          opacity={0.9}
          stroke={getCanvasGradient(
            [
              { color: '#DB1685', offset: 0.0 },
              { color: '#8165D6', offset: 0.5208 },
              { color: '#48A8F6', offset: 0.9583 },
            ],
            {
              x0: 0,
              y0: 0,
              x1: Math.floor(rectWidth) + 40,
              y1: 86,
            }
          )}
          strokeWidth={2}
        />
        <Text
          x={22}
          y={designation === '' && organization === '' ? 0 : 26}
          fill={textColor || '#ffffff'}
          text={userName}
          fontSize={18}
          height={86}
          fontStyle="bold"
          fontFamily="Inter"
          verticalAlign={
            designation === '' && organization === '' ? 'middle' : undefined
          }
          key="username"
        />
        {designation !== '' && organization === '' && (
          <Text
            x={22}
            y={52}
            fill={textColor || '#E5E7EB'}
            text={designation}
            fontSize={12}
            height={96}
            fontFamily="Inter"
            key="designation"
          />
        )}
        {designation === '' && organization !== '' && (
          <Text
            x={22}
            y={52}
            fill={textColor || '#E5E7EB'}
            text={organization}
            fontSize={12}
            height={96}
            fontFamily="Inter"
            key="organization"
          />
        )}
        {designation !== '' && organization !== '' && (
          <Text
            x={22}
            y={52}
            fill={textColor || '#E5E7EB'}
            text={`${designation}, ${organization}`}
            fontSize={12}
            height={96}
            fontFamily="Inter"
            key="designationAndOrganization"
          />
        )}
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
