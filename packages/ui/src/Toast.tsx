import { toast, ToastContainer as TC } from 'react-toastify'
import { ToastOptions } from 'react-toastify/dist/types'

export const defaultToastOptions: ToastOptions = {
	position: toast.POSITION.BOTTOM_CENTER,
	autoClose: 2000,
	hideProgressBar: true,
	closeOnClick: true,
	rtl: false,
	pauseOnFocusLoss: true,
	draggable: true,
	pauseOnHover: true,
	theme: 'dark',
	closeButton: false,
	style: { width: 'fit-content', minHeight: 'auto', maxWidth: '700px' },
	bodyStyle: { width: 'auto' },
	className: 'flex text-center',
	bodyClassName: 'text-size-sm',
} as ToastOptions

export const emitToast = (
	content: string | JSX.Element,
	options?: ToastOptions
) => toast(content, {
		...defaultToastOptions,
		...options,
	} as ToastOptions)

export const updateToast = (
	id: React.ReactText,
	content: string | JSX.Element,
	options?: ToastOptions
) => toast.update(id, {
		render: toast(content, {
			...defaultToastOptions,
			...options,
		} as ToastOptions),
	})

export const dismissToast = (id: any) => {
  toast.dismiss(id)
}

export const ToastContainer = TC
