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



const themes = [
	{
		config: {
			thumbnail: 'themes/DarkGradient/thumbnail.png',
			previewImages: [
				'themes/DarkGradient/1.png',
				'themes/DarkGradient/2.png',
				'themes/DarkGradient/3.png',
				'themes/DarkGradient/4.png',
				'themes/DarkGradient/5.png',
				'themes/DarkGradient/6.png',
				'themes/DarkGradient/7.png',
				'themes/DarkGradient/8.png',
				'themes/DarkGradient/9.png',
			],
			viewConfig: {},
		},
		name: 'DarkGradient',
	},
	{
		config: {
			thumbnail: 'themes/PastelLines/thumbnail.png',
			previewImages: [
				'themes/PastelLines/1.png',
				'themes/PastelLines/2.png',
				'themes/PastelLines/3.png',
				'themes/PastelLines/4.png',
				'themes/PastelLines/5.png',
				'themes/PastelLines/6.png',
				'themes/PastelLines/7.png',
				'themes/PastelLines/8.png',
				'themes/PastelLines/9.png',
				'themes/PastelLines/10.png',
				'themes/PastelLines/11.png',
				'themes/PastelLines/12.png',
				'themes/PastelLines/13.png',
			],
			viewConfig: {},
		},
		name: 'PastelLines',
	},
	{
		config: {
			thumbnail: 'themes/Rainbow/thumbnail.png',
			previewImages: [
				'themes/Rainbow/1.png',
				'themes/Rainbow/2.png',
				'themes/Rainbow/3.png',
				'themes/Rainbow/4.png',
				'themes/Rainbow/5.png',
				'themes/Rainbow/6.png',
				'themes/Rainbow/7.png',
				'themes/Rainbow/8.png',
				'themes/Rainbow/9.png',
				'themes/Rainbow/10.png',
				'themes/Rainbow/11.png',
			],
			viewConfig: {},
		},
		name: 'Rainbow',
	},
	{
		config: {
			thumbnail: 'themes/Iceberg/thumbnail.png',
			previewImages: [
				'themes/Iceberg/1.png',
				'themes/Iceberg/2.png',
				'themes/Iceberg/3.png',
				'themes/Iceberg/4.png',
				'themes/Iceberg/5.png',
				'themes/Iceberg/6.png',
				'themes/Iceberg/7.png',
				'themes/Iceberg/8.png',
				'themes/Iceberg/9.png',
			],
			viewConfig: {},
		},
		name: 'Iceberg',
	},
	{
		config: {
			thumbnail: 'themes/Midnight/thumbnail.png',
			previewImages: [
				'themes/Midnight/1.png',
				'themes/Midnight/2.png',
				'themes/Midnight/3.png',
				'themes/Midnight/4.png',
				'themes/Midnight/5.png',
				'themes/Midnight/6.png',
				'themes/Midnight/7.png',
				'themes/Midnight/8.png',
			],
			viewConfig: {},
		},
		name: 'Midnight',
	},
	{
		config: {
			thumbnail: 'themes/Spiro/thumbnail.png',
			previewImages: [
				'themes/Spiro/1.png',
				'themes/Spiro/2.png',
				'themes/Spiro/3.png',
				'themes/Spiro/4.png',
				'themes/Spiro/5.png',
				'themes/Spiro/6.png',
				'themes/Spiro/7.png',
				'themes/Spiro/8.png',
				'themes/Spiro/9.png',
			],
			viewConfig: {},
		},
		name: 'Spiro',
	},
	{
		config: {
			thumbnail: 'themes/DevsForUkraine/thumbnail.png',
			previewImages: [
				'themes/DevsForUkraine/1.png',
				'themes/DevsForUkraine/2.png',
				'themes/DevsForUkraine/3.png',
				'themes/DevsForUkraine/4.png',
				'themes/DevsForUkraine/5.png',
				'themes/DevsForUkraine/6.png',
				'themes/DevsForUkraine/7.png',
				'themes/DevsForUkraine/8.png',
				'themes/DevsForUkraine/9.png',
			],
			viewConfig: {},
		},
		name: 'DevsForUkraine',
	},
	{
		config: {
			thumbnail: 'themes/Obsidian/thumbnail.png',
			previewImages: [
				'themes/Obsidian/1.png',
				'themes/Obsidian/2.png',
				'themes/Obsidian/3.png',
				'themes/Obsidian/4.png',
				'themes/Obsidian/5.png',
				'themes/Obsidian/6.png',
				'themes/Obsidian/7.png',
				'themes/Obsidian/8.png',
				'themes/Obsidian/9.png',
				'themes/Obsidian/10.png',
				'themes/Obsidian/11.png',
				'themes/Obsidian/12.png',
			],
			viewConfig: {},
		},
		name: 'Obsidian',
	},
	{
		config: {
			thumbnail: 'themes/Cardinal/thumbnail.png',
			previewImages: [
				'themes/Cardinal/1.png',
				'themes/Cardinal/2.png',
				'themes/Cardinal/3.png',
				'themes/Cardinal/4.png',
				'themes/Cardinal/5.png',
				'themes/Cardinal/6.png',
				'themes/Cardinal/7.png',
				'themes/Cardinal/8.png',
				'themes/Cardinal/9.png',
			],
			viewConfig: {},
		},
		name: 'Cardinal',
	},
	{
		config: {
			thumbnail: 'themes/Velvet/thumbnail.png',
			previewImages: [
				'themes/Velvet/1.png',
				'themes/Velvet/2.png',
				'themes/Velvet/3.png',
				'themes/Velvet/4.png',
				'themes/Velvet/5.png',
				'themes/Velvet/6.png',
				'themes/Velvet/7.png',
				'themes/Velvet/8.png',
			],
			viewConfig: {},
		},
		name: 'Velvet',
	},
	{
		config: {
			thumbnail: 'themes/CherryBlossom/thumbnail.png',
			previewImages: [
				'themes/CherryBlossom/1.png',
				'themes/CherryBlossom/2.png',
				'themes/CherryBlossom/3.png',
				'themes/CherryBlossom/4.png',
				'themes/CherryBlossom/5.png',
				'themes/CherryBlossom/6.png',
				'themes/CherryBlossom/7.png',
				'themes/CherryBlossom/8.png',
				'themes/CherryBlossom/9.png',
				'themes/CherryBlossom/10.png',
				'themes/CherryBlossom/11.png',
			],
			viewConfig: {},
		},
		name: 'CherryBlossom',
	},
	{
		config: {
			thumbnail: 'themes/Lilac/thumbnail.png',
			previewImages: [
				'themes/Lilac/1.png',
				'themes/Lilac/2.png',
				'themes/Lilac/3.png',
				'themes/Lilac/4.png',
				'themes/Lilac/5.png',
				'themes/Lilac/6.png',
				'themes/Lilac/7.png',
				'themes/Lilac/8.png',
				'themes/Lilac/9.png',
				'themes/Lilac/10.png',
				'themes/Lilac/11.png',
			],
			viewConfig: {},
		},
		name: 'Lilac',
	},
]

export default themes
