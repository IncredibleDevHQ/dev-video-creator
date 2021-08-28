import {
  FlickParticipantsFragment,
  Fragment_Type_Enum_Enum,
  Participant_Role_Enum_Enum,
} from '../../../generated/graphql'
import BaseFragment from './BaseFragment'
import Basics from './Basics'
import Participants from './Participants'
import Stepper from './Stepper'

export type FormParticipant = FlickParticipantsFragment & {
  role: Participant_Role_Enum_Enum
}

export interface Form {
  name: string
  description?: string
  type?: Fragment_Type_Enum_Enum
  participants: FormParticipant[]
}

export { BaseFragment, Stepper, Basics, Participants }
