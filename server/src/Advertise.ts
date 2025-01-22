import { Server as SSDP } from 'node-ssdp';

/**
 * SSDP Advertising Service
 */
export class Advertise {
  private server: SSDP;

  constructor() {
    this.server = new SSDP({
      location: {
        port: 34400,
        path: '/device.xml',
      },
      udn: `uuid:d936e232-6671-4cd7-a8ab-34b5956ff4d6`,
      allowWildcards: true,
      ssdpSig: 'Piparr/0.1 UPnP/1.0',
      customLogger: process.env['ENABLE_SSDP_DEBUG_LOGGING']
        ? console.debug
        : undefined,
    });

    this.server.addUSN('upnp:rootdevice');
    this.server.addUSN('urn:schemas-upnp-org:device:MediaServer:1');
    this.server.addUSN('urn:schemas-upnp-org:device:SatIPServer:1');
  }

  get ssdp(): SSDP {
    return this.server;
  }

  getHdhrDevice(host: string) {
    return {
      FriendlyName: 'Piparr',
      Manufacturer: 'Piparr - Silicondust',
      ManufacturerURL: 'https://github.com/chrisbenincasa/Piparr',
      ModelNumber: 'HDTC-2US',
      FirmwareName: 'hdhomeruntc_atsc',
      TunerCount: 1,
      FirmwareVersion: '20170930',
      DeviceID: 'Piparr',
      DeviceAuth: '',
      BaseURL: `${host}`,
      LineupURL: `${host}/lineup.json`,
    };
  }

  getHdhrDeviceXml(host: string) {
    return `<root xmlns="urn:schemas-upnp-org:device-1-0">
          <URLBase>${host}</URLBase>
          <specVersion>
            <major>1</major>
            <minor>0</minor>
          </specVersion>
          <device>
            <deviceType>urn:schemas-upnp-org:device:MediaServer:1</deviceType>
            <friendlyName>Piparr</friendlyName>
            <manufacturer>Silicondust</manufacturer>
            <modelName>HDTC-2US</modelName>
            <modelNumber>HDTC-2US</modelNumber>
            <serialNumber/>
            <UDN>uuid:d936e232-6671-4cd7-a8ab-34b5956ff4d6</UDN>
          </device>
          </root>`;
  }

  private static _instance: Advertise;

  public static Instance() {
    if (!this._instance)
        this._instance = new Advertise();

    return this._instance;
  }
}