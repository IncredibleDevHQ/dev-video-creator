import {
  CodejamConfig,
  TriviaConfig,
  VideojamConfig,
  PointsConfig,
  LayoutConfig,
  ViewConfig,
} from '../../configTypes'

type FragmentConfig =
  | CodejamConfig
  | TriviaConfig
  | VideojamConfig
  | PointsConfig

export const generateViewConfig = ({
  dataConfig,
  viewConfig,
}: {
  dataConfig: FragmentConfig[]
  viewConfig: ViewConfig
}) => {
  let tempViewConfig = viewConfig
  const configs: LayoutConfig[] = []

  if (viewConfig.configs.length >= dataConfig.length) {
    if (viewConfig.configs.length > dataConfig.length)
      tempViewConfig = {
        ...tempViewConfig,
        configs: viewConfig.configs.slice(0, dataConfig.length),
      }

    tempViewConfig.configs.forEach((config, index) => {
      configs.push({
        ...config,
        id: dataConfig[index].id,
        type: dataConfig[index].type,
      })
    })
  } else {
    viewConfig.configs.forEach((config, index) => {
      configs.push({
        ...config,
        id: dataConfig[index].id,
        type: dataConfig[index].type,
      })
    })
    dataConfig.slice(viewConfig.configs.length).forEach((config) => {
      configs.push({
        id: config.id,
        type: config.type,
        layoutNumber: 1,
        background: {
          type: 'color',
          gradient: {
            cssString:
              'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
            values: [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8'],
            startIndex: {
              x: 0,
              y: 269.99999999999994,
            },
            endIndex: {
              x: 960,
              y: 270.00000000000006,
            },
          },
        },
      })
    })
  }

  return {
    ...viewConfig,
    configs,
  } as ViewConfig
}
