import { Xmltv, XmltvChannel, XmltvProgramme } from "@iptv/xmltv"

export interface Stream {
    id: number,
    name: string,
    stream: string,
    connections: number,
    last_updated: string,
    regex?: string
    type: string
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
    stream_id: number,
    stream_channel: string
}

export interface ChannelSourceInternal {
    id: string, 
    name: string,
    stream: number,
    logo?: string,

    endpoint: string
}

export interface EpgInternal {
    stream: number,
    epg: Xmltv
}

export interface EpgBuilder {
    channels: XmltvChannel[],
    programs: XmltvProgramme[],
    xmltv: Xmltv | null
}