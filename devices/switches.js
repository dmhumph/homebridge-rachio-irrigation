let RachioAPI = require('../rachioapi')

class switches {
	constructor(platform, log) {
		this.log = log
		this.platform = platform
		this.rachioapi = new RachioAPI(platform, log)
	}

	createScheduleSwitchService(schedule) {
		// Create Valve Service
		this.log.debug('Created service for %s with id %s', schedule.name, schedule.id)
		let switchService = new Service.Switch(schedule.name, schedule.id)
		switchService.addCharacteristic(Characteristic.ConfiguredName)
		switchService.addCharacteristic(Characteristic.SerialNumber)
		switchService
			.setCharacteristic(Characteristic.On, false)
			.setCharacteristic(Characteristic.Name, schedule.name)
			.setCharacteristic(Characteristic.ConfiguredName, schedule.name)
			.setCharacteristic(Characteristic.SerialNumber, schedule.id)
			.setCharacteristic(Characteristic.StatusFault, Characteristic.StatusFault.NO_FAULT)
		return switchService
	}

	createSwitchService(switchName, uuid) {
		// Create Valve Service
		this.log.debug('adding new switch')
		let switchService = new Service.Switch(switchName, uuid)
		switchService.addCharacteristic(Characteristic.ConfiguredName)
		switchService
			.setCharacteristic(Characteristic.On, false)
			.setCharacteristic(Characteristic.Name, switchName)
			.setCharacteristic(Characteristic.ConfiguredName, switchName)
			.setCharacteristic(Characteristic.StatusFault, Characteristic.StatusFault.NO_FAULT)
		return switchService
	}

	configureSwitchService(device, switchService) {
		// Configure Valve Service
		this.log.info('Configured switch for %s', switchService.getCharacteristic(Characteristic.Name).value)
		switchService.getCharacteristic(Characteristic.On).on('get', this.getSwitchValue.bind(this, switchService)).on('set', this.setSwitchValue.bind(this, device, switchService))
	}

	async setSwitchValue(device, switchService, value, callback) {
		this.log.info('HomeKit toggle received for switch %s -> %s', switchService.getCharacteristic(Characteristic.Name).value, value ? 'ON' : 'OFF')
		let response
		switch (switchService.getCharacteristic(Characteristic.Name).value) {
			case device.name + ' Standby':
				if (switchService.getCharacteristic(Characteristic.StatusFault).value == Characteristic.StatusFault.GENERAL_FAULT) {
					callback('error')
				} else {
					if (value == false) {
						try {
							response = await this.rachioapi.deviceStandby(this.platform.token, device, 'on')
						} catch (err) {
							this.log.error('Failed to disable standby for %s: %s', device.name, err.message || err)
							callback(err)
							return
						}
						if (response.status == 204) {
							switchService.getCharacteristic(Characteristic.On).updateValue(value)
						}
					} else if (value == true) {
						try {
							response = await this.rachioapi.deviceStandby(this.platform.token, device, 'off')
						} catch (err) {
							this.log.error('Failed to enable standby for %s: %s', device.name, err.message || err)
							callback(err)
							return
						}
						if (response.status == 204) {
							switchService.getCharacteristic(Characteristic.On).updateValue(value)
						}
					}
					callback()
				}
				break
			case device.name + ' Quick Run All':
				if (switchService.getCharacteristic(Characteristic.StatusFault).value == Characteristic.StatusFault.GENERAL_FAULT) {
					callback('error')
				} else {
					if (value) {
						let completeRun = 0
						let x
						device.zones.forEach(zone =>{
							completeRun = completeRun + this.platform.defaultRuntime
						})
						clearTimeout(x)
						x = setTimeout(() => {
							switchService.getCharacteristic(Characteristic.On).updateValue(false)
							this.log.info('Quick Run All finished, completed after %s minutes', completeRun/60)
						}, completeRun*1000);

						try {
							response = await this.rachioapi.startMultipleZone(this.platform.token, device.zones, this.platform.defaultRuntime)
						} catch (err) {
							this.log.error('Failed to start Quick Run All on %s: %s', device.name, err.message || err)
							callback(err)
							return
						}
						if (response.status == 204) {
							switchService.getCharacteristic(Characteristic.On).updateValue(value)
						}
					} else {
						try {
							response = await this.rachioapi.stopDevice(this.platform.token, device.id)
						} catch (err) {
							this.log.error('Failed to stop Quick Run All on %s: %s', device.name, err.message || err)
							callback(err)
							return
						}
						if (response.status == 204) {
							switchService.getCharacteristic(Characteristic.On).updateValue(value)
						}
					}
					callback()
				}
				break
			default: //using scheule names
				if (switchService.getCharacteristic(Characteristic.StatusFault).value == Characteristic.StatusFault.GENERAL_FAULT) {
					callback('error')
				} else {
					if (value) {
						try {
							response = await this.rachioapi.startSchedule(this.platform.token, switchService.getCharacteristic(Characteristic.SerialNumber).value)
						} catch (err) {
							this.log.error('Failed to start schedule %s: %s', switchService.getCharacteristic(Characteristic.Name).value, err.message || err)
							callback(err)
							return
						}
						if (response.status == 204) {
							switchService.getCharacteristic(Characteristic.On).updateValue(true)
						}
					} else {
						try {
							response = await this.rachioapi.stopDevice(this.platform.token, device.id)
						} catch (err) {
							this.log.error('Failed to stop schedule on %s: %s', device.name, err.message || err)
							callback(err)
							return
						}
						if (response.status == 204) {
							switchService.getCharacteristic(Characteristic.On).updateValue(false)
						}
					}
					callback()
				}
				break
		}
	}

	getSwitchValue(switchService, callback) {
		if (switchService.getCharacteristic(Characteristic.StatusFault).value == Characteristic.StatusFault.GENERAL_FAULT) {
			callback('error')
		} else {
			callback(null, switchService.getCharacteristic(Characteristic.On).value)
		}
	}
}
module.exports = switches
