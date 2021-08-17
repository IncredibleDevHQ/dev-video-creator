import { useLocation } from 'react-router-dom'

const useQueryVariables = () => {
  return new URLSearchParams(useLocation().search)
}
export default useQueryVariables
