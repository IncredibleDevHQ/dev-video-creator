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

export enum FragmentTypeEnum {
	Landscape = 'Landscape',
	Portrait = 'Portrait',
	Presentation = 'Presentation',
	Blog = 'Blog',
}

export enum FlickScopeEnum {
	Public = 'Public',
	Private = 'Private',
}

export enum InvitationStatusEnum {
	Pending = 'Pending',
	Accepted = 'Accepted',
	Declined = 'Declined',
	Email = 'Email',
}

export enum NotificationTypeEnum {
	/** To communicate something async failed.  */
	Error = 'Error',
	/** Indicates some platform event , such as a flick is publish, blog is now live etc. */
	Event = 'Event',
	/** Indicates that the notification is either an invite or request to collaborate */
	Invitation = 'Invitation',
	/** Request */
	Request = 'Request',
}

export enum NotificationMetaTypeEnum {
	Flick = 'Flick',
	Follow = 'Follow',
	/** the meta will contains series details */
	Series = 'Series',
	/** the meta will contains user/profile details */
	User = 'User',
}

export enum ParticipantRoleEnum {
	Host = 'Host',
	Assistant = 'Assistant',
	Viewer = 'Viewer',
}

export enum ContentTypeEnum {
	Blog = 'Blog',
	VerticalVideo = 'VerticalVideo',
	Video = 'Video',
}

export enum RecordingStatusEnum {
	Pending = 'pending',
	Checkpoint = 'checkpoint',
	Completed = 'completed',
	Processing = 'processing',
}

export enum OrientationEnum {
	Landscape = 'LANDSCAPE',
	Portrait = 'PORTRAIT',
}

export enum UploadType {
	Asset = 'Asset',
	Block = 'Block',
	Brand = 'Brand',
	Markdown = 'Markdown',
	Thumbnail = 'Thumbnail',
	Profile = 'Profile',
}

export enum ContentContainerEnum {
	Flick = 'Flick',
	Series = 'Series',
}
