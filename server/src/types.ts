import { Xmltv, XmltvChannel, XmltvProgramme } from "@iptv/xmltv"

export interface Provider {
    id: number,
    name: string,
    stream: string,
    epg: string,
    connections: number,
    last_updated: string,
    regex?: string
}

export interface Channel {
    id: number,
    name: string,
    logo?: string,
    channel_number: number
}

export interface ChannelSource {
    id: number,
    channel_id: number,
    provider_id: number,
    provider_channel: string
}

export interface ChannelSourceInternal {
    id: string, 
    name: string,
    provider: number,
    logo?: string,

    endpoint: string
}

export interface EpgInternal {
    provider: number,
    epg: Xmltv
}

export interface EpgBuilder {
    channels: XmltvChannel[],
    programs: XmltvProgramme[],
    xmltv: Xmltv | null
}