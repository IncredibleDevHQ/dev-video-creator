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
