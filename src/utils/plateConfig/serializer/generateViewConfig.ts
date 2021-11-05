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
          type: 'image',
          image: '',
        },
      })
    })
  }

  return {
    configs,
    hasTitleSplash: true,
  } as ViewConfig
}
