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

import { useRouter } from 'next/router'
import type { NextRouter } from 'next/router'
import { useRef, useState } from 'react'

// A safe to use hook to include router.push() as a dependency to a useEffect
export default function usePush(): NextRouter['push'] {
	const router = useRouter()
	const routerRef = useRef(router)

	routerRef.current = router

	const [{ push }] = useState<Pick<NextRouter, 'push'>>({
		push: path => routerRef.current.push(path),
	})

	return push
}
