export enum FragmentTypeEnum {
	Landscape = 'Landscape',
	Portrait = 'Portrait',
	Presentation = 'Presentation',
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
	pending = 'pending',
	checkpoint = 'checkpoint',
	completed = 'completed',
	processing = 'processing',
}

export enum OrientationEnum {
	Landscape = 'LANDSCAPE',
	Portrait = 'PORTRAIT',
}
