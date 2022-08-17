// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

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
