import { cx } from '@emotion/css'
import React from 'react'
import { IconType } from 'react-icons'
import { FaBeer } from 'react-icons/fa'
import { Link } from 'react-router-dom'
import logo from '../assets/logo_mono.svg'

interface NavItemProps {
  icon: IconType
  active?: boolean
  to: string
}

const NavItem = ({ icon: I, active, to }: NavItemProps) => {
  return (
    <Link to={to}>
      <li className="py-3">
        <I
          className={cx('text-2xl', {
            'text-white': active,
            'text-gray-300': !active,
          })}
        />
        <div className={cx('flex mt-1.5', { invisible: !active })}>
          <span className="w-1 h-1 flex-shrink-0 rounded-full bg-white" />
          <span className="w-full h-1 ml-0.5 rounded-full bg-white" />
        </div>
      </li>
    </Link>
  )
}

const Sidebar = () => {
  return (
    <div className="bg-brand py-4 px-3 rounded-tr-3xl flex items-center flex-col justify-between rounded-bl-3xl">
      <img className="w-10" src={logo} alt="Logo" />
      <ul>
        <NavItem to="home" icon={FaBeer} />
        <NavItem to="about" icon={FaBeer} active />
      </ul>
      <span />
    </div>
  )
}

NavItem.defaultProps = {
  active: undefined,
}

export default Sidebar
