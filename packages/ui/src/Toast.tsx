// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
) =>
	toast(content, {
		...defaultToastOptions,
		...options,
	} as ToastOptions)

export const updateToast = (
	id: React.ReactText,
	content: string | JSX.Element,
	options?: ToastOptions
) =>
	toast.update(id, {
		render: content,
		...options,
	})

export const dismissToast = (id: any) => {
	toast.dismiss(id)
}

export const ToastContainer = TC
