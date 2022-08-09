import { cx } from '@emotion/css'
import { Dialog } from '@headlessui/react'
import axios from 'axios'
import { marked } from 'marked'
import React, { useEffect, useRef, useState } from 'react'
import { IconType } from 'react-icons'
import { HiOutlineDownload, HiOutlineSparkles } from 'react-icons/hi'
import { IoAddOutline, IoCopyOutline } from 'react-icons/io5'
import { FlickScopeEnum } from 'src/utils/enums'
import usePush from 'src/utils/hooks/usePush'
import { Button, emitToast, Heading, Loader, Text } from 'ui/src'
import trpc from '../../server/trpc'

enum OptionType {
	blank = 'blank',
	local = 'local',
	link = 'link',
}

interface Option {
	icon: IconType
	title: string
	description: string
	type: OptionType
}

const options: Option[] = [
	{
		icon: HiOutlineSparkles,
		title: 'Create blank story',
		description: 'New story with empty markdown',
		type: OptionType.blank,
	},
	{
		icon: HiOutlineDownload,
		title: 'Import local markdown',
		description: 'New story with local markdown',
		type: OptionType.local,
	},
	{
		icon: IoCopyOutline,
		title: 'Paste markdown link',
		description: 'New story with markdown from link',
		type: OptionType.link,
	},
]

const isRawUrl = (url: string) => {
	const rawMarkdownUrlRegex =
		/^https:\/\/raw.githubusercontent.com\/.*\/.*\/.*\/.*\.md$/
	return rawMarkdownUrlRegex.test(url)
}

const getRawUrl = (from: string) => {
	if (isRawUrl(from)) return from
	// convert github.com to raw.githubusercontent.com for any repository
	const url = from.replace(
		/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)$/,
		'https://raw.githubusercontent.com/$1/$2/$3/$4'
	)

	return url
}

const isUrlValid = (url: string) => {
	const urlWithoutTrailingSlash = url.replace(/\/$/, '')

	// check if url is for a markdown file
	const markdownUrlRegex =
		/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)\.md$/
	const rawMarkdownUrlRegex =
		/^https:\/\/raw.githubusercontent.com\/.*\/.*\/.*\/.*\.md$/

	return (
		markdownUrlRegex.test(urlWithoutTrailingSlash) ||
		rawMarkdownUrlRegex.test(urlWithoutTrailingSlash)
	)
}

const CreateFlickModal = ({
	open,
	handleClose,
	markdownHTML,
	type,
}: {
	open: boolean
	handleClose: () => void
	markdownHTML: string | undefined
	type: OptionType
}) => {
	const push = usePush()
	const [url, setUrl] = useState('')

	const createFlick = trpc.useMutation(['story.create'])
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (type !== OptionType.link)
			if (markdownHTML) {
				createFlick.mutateAsync({
					name: 'Untitled',
					scope: FlickScopeEnum.Private,
					md: markdownHTML,
				})
			} else {
				createFlick.mutateAsync({
					name: 'Untitled',
					scope: FlickScopeEnum.Private,
				})
			}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (!createFlick.data) return
		handleClose()
		push(`/story/${createFlick.data.id}`)
	}, [createFlick.data, push, handleClose])

	useEffect(() => {
		if (!createFlick.error) return
		emitToast('Could not create your story', {
			type: 'error',
		})
		handleClose()
	}, [createFlick.error, createFlick.isError, handleClose])

	const handleCreate = async () => {
		try {
			setLoading(true)
			const response = await axios.get(getRawUrl(url))
			const markdown = response.data as string
			const html = marked.parse(markdown, {
				gfm: true,
				smartLists: true,
				smartypants: true,
			})
			await createFlick.mutateAsync({
				name: 'Untitled',
				scope: FlickScopeEnum.Public,
				md: html,
			})
		} catch (e) {
			emitToast('Could not create your story', {
				type: 'error',
			})
		} finally {
			setLoading(false)
		}
	}

	return (
		<Dialog
			open={open}
			onClose={() => (type === OptionType.link ? handleClose() : undefined)}
			className={cx(
				'fixed z-50 inset-0 m-auto w-2/5 flex items-center justify-center',
				{
					'w-2/5': type === OptionType.link,
				}
			)}
		>
			<Dialog.Overlay
				onClick={() => {}}
				className='fixed inset-0 bg-black opacity-60'
			/>
			{type !== OptionType.link && (
				<div className='flex flex-col items-center bg-dark-200 z-50 px-14 py-16 text-white rounded-sm font-main'>
					<Loader className='w-12 h-12 mb-8' />
					Creating your story
				</div>
			)}
			{type === OptionType.link && (
				<div className='flex flex-col gap-y-4 bg-dark-200 p-4 z-50 w-full text-white rounded-sm'>
					<input
						value={url}
						onChange={e => setUrl(e.target.value)}
						placeholder='https://github.com/user/repo/blob/main/README.md'
						className='w-full bg-dark-400 border border-transparent py-3 px-3 mt-1.5 focus:outline-none text-gray-100 text-size-sm rounded-sm focus:border-green-600'
					/>
					{url !== '' && !isUrlValid(url) && (
						<span className='text-size-xxs text-red-500 -mt-2 ml-px'>
							Entered URL is not valid
						</span>
					)}
					<Button
						disabled={url === '' || !isUrlValid(url)}
						loading={loading}
						size='large'
						className='max-w-none'
						onClick={() => {
							handleCreate()
						}}
					>
						Create
					</Button>
				</div>
			)}
		</Dialog>
	)
}

const Card = ({ description, icon: I, title, type }: Option) => {
	const [openCreate, setOpenCreate] = useState(false)
	const [markdownHTML, setMarkdownHTML] = useState<string>()

	const inputRef = useRef<HTMLInputElement>(null)

	const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return
		const reader = new FileReader()
		reader.onload = onLoadEvent => {
			const mdHTML = marked.parse(
				onLoadEvent.target?.result?.toString() || '',
				{
					gfm: true,
					smartLists: true,
					smartypants: true,
				}
			)
			setMarkdownHTML(mdHTML)
			setOpenCreate(true)
		}
		reader.readAsText(file)
	}

	return (
		<div>
			<button
				type='button'
				className='bg-dark-400 rounded-md flex justify-between text-start items-center p-3 cursor-pointer hover:bg-dark-300 transform active:scale-95 w-full transition-all'
				onClick={() => {
					if (type === OptionType.local) {
						inputRef.current?.click()
					} else {
						setOpenCreate(true)
					}
				}}
			>
				<div
					className={cx(`p-2.5 rounded-sm`, {
						'bg-green-600/10': type === OptionType.blank,
						'bg-[#7C3AED]/10': type === OptionType.local,
						'bg-[#0891B2]/10': type === OptionType.link,
					})}
				>
					<I
						size={24}
						className={cx({
							'text-green-600': type === OptionType.blank,
							'text-[#7C3AED]': type === OptionType.local,
							'text-[#0891B2]': type === OptionType.link,
						})}
					/>
				</div>
				<div className='flex-1 mx-4 flex flex-col gap-y-1'>
					<Heading textStyle='smallTitle'>{title}</Heading>
					<Text textStyle='bodySmall' className='text-dark-title-200'>
						{description}
					</Text>
				</div>
				<div className='ml-4'>
					<IoAddOutline size={16} className='text-dark-title-200' />
				</div>
				{type === OptionType.local && (
					<input
						ref={inputRef}
						type='file'
						className='hidden'
						onChange={handleSelectFile}
						accept='.md'
					/>
				)}
			</button>
			{openCreate && (
				<CreateFlickModal
					key={type}
					open={openCreate}
					handleClose={() => {
						setOpenCreate(false)
						setMarkdownHTML(undefined)
					}}
					markdownHTML={markdownHTML}
					type={type}
				/>
			)}
		</div>
	)
}

const Header = ({ vertical = false }: { vertical?: boolean }) => (
	<div
		className={cx('flex gap-x-6', {
			'flex-col gap-y-6': vertical,
		})}
	>
		{options.map(option => (
			<Card
				key={option.type}
				description={option.description}
				icon={option.icon}
				title={option.title}
				type={option.type}
			/>
		))}
	</div>
)

export default Header
