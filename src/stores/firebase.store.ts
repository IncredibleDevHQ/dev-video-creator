import { atom } from 'recoil'
import { FirebaseApp, initializeApp } from 'firebase/app'
import { FirebaseDatabase, getDatabase } from 'firebase/database'
import { Auth, getAuth } from 'firebase/auth'
import config from '../config'

const {
  firebase: { default: firebaseConfig },
} = config
const app = initializeApp(firebaseConfig)

const firebaseAuth = getAuth(app)
const database = getDatabase(app)

interface FirebaseStore {
  app: FirebaseApp
  auth: Auth
  database: FirebaseDatabase
}

const firebaseState = atom<FirebaseStore>({
  key: 'firebaseState',
  default: { app, database, auth: firebaseAuth },
  dangerouslyAllowMutability: true,
})

export default firebaseState