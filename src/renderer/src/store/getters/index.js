import setup from './setup'
import auth from './auth'
import config from './config'
import catalogos from './catalogos'
import ui from './ui'

export default { ...setup, ...auth, ...config, ...catalogos, ...ui }
