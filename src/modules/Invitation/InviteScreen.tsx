import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import React, { useEffect, useState } from 'react'
import { useRecoilValue } from 'recoil'
import { useParams, useHistory } from 'react-router-dom'
import Modal from 'react-responsive-modal'
import firebaseState from '../../stores/firebase.store'
import { Button, Heading, TextField } from '../../components'

const InviteScreen = () => {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const { flickId }: { flickId: string } = useParams()
  const history = useHistory()

  const onOpenModal = () => setOpen(true)
  const onCloseModal = () => setOpen(false)

  const { auth } = useRecoilValue(firebaseState)
  async function handleSignIn() {
    if (!email) return

    try {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        const data = await signInWithEmailLink(
          auth,
          email,
          window.location.href
        )
        console.log('logindata', data)
        history.push(`/flick/${flickId}`)
        onCloseModal()
      }
    } catch (error) {
      //   emitToast({
      //     title: 'Something went Wrong!',
      //     type: 'error',
      //     // description: error as string,
      //     onClick: () => window.location.reload(),
      //   })
      console.log(error)
    }
  }

  useEffect(() => {
    onOpenModal()
  }, [])

  return (
    <Modal open={open} onClose={onCloseModal} center>
      <div className="m-4 w-96">
        <Heading className="text-3xl font-bold">Verify Your Email</Heading>
        <TextField
          label="Email"
          className="py-5"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target?.value)
          }
        />
        <Button onClick={handleSignIn} type="button" appearance="primary">
          Verify
        </Button>
      </div>
    </Modal>
  )
}

export default InviteScreen
