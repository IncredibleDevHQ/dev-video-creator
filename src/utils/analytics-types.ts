export const enum PageCategory {
  Main = 'Main',
  Studio = 'Studio',
  DeviceSelect = 'DeviceSelect',
  Recording = 'Recording',
}

export const enum PageTitle {
  // Main
  Dashboard = 'Dashboard',
  Notifications = 'Notifications',
  // Studio
  Notebook = 'Notebook',
  Preview = 'Preview',
  Brand = 'Brand',
  Theme = 'Theme',
  Playback = 'Playback',
  Download = 'Download',
  Invite = 'Invite',
  VideoEditor = 'Video Editor',
  // Backstage
  DeviceSelect = 'DeviceSelect',
  // Recording
  Recording = 'Recording',
}

export enum PageEvent {
  /* ---------------
   * MAIN PAGE EVENTS
   * ---------------*/

  // DASHBOARD EVENTS
  CreateBlankStory = 'CreateBlankStory',
  CreateStoryFromLocalMarkdown = 'CreateStoryFromLocalMarkdown',
  CreateStoryFromLink = 'CreateStoryFromLink',

  /* ---------------
   * STUDIO PAGE EVENTS
   * ---------------*/

  // NOTEBOOK & PREVIEW PAGE EVENTS
  SelectLandscapeMode = 'SelectLandscapeMode',
  SelectPortraitMode = 'SelectPortraitMode',
  GoToDeviceSelect = 'GoToDeviceSelect',
  OpenTimeLine = 'OpenTimeLine',
  CloseTimeLine = 'CloseTimeLine',
  SelectBrand = 'SelectBrand',
  OpenBrandingModal = 'OpenBrandingModal',
  BackToDashboard = 'BackToDashboard',

  // NOTEBOOK PAGE EVENTS
  NotebookCanvasPreview = 'NotebookCanvasPreview',
  AddSpeaker = 'AddSpeaker',
  InvokeSlashCommandMenu = 'InvokeSlashCommandMenu',

  // PREVIEW PAGE EVENTS
  ChangeLayout = 'ChangeLayout',
  NavNextBlock = 'NavNextBlock',
  NavPreviousBlock = 'NavPreviousBlock',
  TimelineBlockPick = 'TimelineBlockPick',

  // THEME PAGE EVENTS
  SelectTheme = 'SelectTheme',
  ApplyTheme = 'ApplyTheme',

  // BRAND PAGE EVENTS
  AddNewBrand = 'AddNewBrand',
  LogoSettings = 'LogoSettings',
  BackgroundSettings = 'BackgroundSettings',
  ColorSettings = 'ColorSettings',
  FontSettings = 'FontSettings',
  IntroVideoSettings = 'IntroVideoSettings',
  DeleteBranding = 'DeleteBranding',

  // DOWNLOAD PAGE EVENTS
  LandscapeSelected = 'LandscapeSelected',
  PortraitSelected = 'PortraitSelected',
  Download = 'Download',

  // INVITE PAGE EVENTS
  InviteCollaborator = 'InviteCollaborator',

  // VIDEO EDITOR EVENTS
  UploadLocalFile = 'UploadLocalFile',
  RecordScreen = 'RecordScreen',
  TrimVideo = 'TrimVideo',
  CropVideo = 'CropVideo',

  /* ---------------
   * DEVICE SELECT PAGE EVENTS
   * ---------------*/
  ChangeCamera = 'ChangeCamera',
  ChangeMicrophone = 'ChangeMicrophone',
  CheckLiveStream = 'CheckLiveStream',
  UncheckLiveStream = 'UncheckLiveStream',
  Record = 'Record',

  /* ---------------
   * RECORDING PAGE EVENTS
   * ---------------*/
  // MAIN CONTROLS
  StartRecording = 'StartRecording',
  StopRecording = 'StopRecording',
  MuteMicrophone = 'MuteMicrophone',
  MuteVideo = 'MuteVideo',
  PickZoomCursor = 'PickZoomCursor',
  DropZoomCursor = 'DropZoomCursor',
  NextItem = 'NextItem',

  // CODE JAM
  NextToken = 'NextToken',
  NextLine = 'NextLine',
  FocusLine = 'FocusLine',

  // POINTS
  NextPoint = 'NextPoint',

  // VIDEOJAM
  PlayVideoJam = 'PlayVideoJam',
  PauseVideoJam = 'PauseVideoJam',

  // POST RECODING
  PlayPreview = 'PlayPreview',
  SaveRecording = 'SaveRecording',
  Retake = 'Retake',

  // ERROR
  Error = 'Error',
}
