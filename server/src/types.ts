// Interface representing a stream with its properties
export interface Stream {
    id: number, // Unique identifier for the stream
    name: string, // Name of the stream
    stream: string, // Stream URL for loading
    connections: number, // Number of active connections
    last_updated: number, // Timestamp of the last update
    nameRegex?: string, // Regex pattern for filtering by name
    idRegex?: string, // Regex pattern for filtering by id
    groupRegex?: string, // Regex pattern for filtering by group
    type: string // Type of the stream (e.g., direct, playlist),
    healthy: number // The current health status of the stream (-1 retrying, 0 failed, 1 healthy, 2 refreshing)
}

// Interface representing a channel with its properties
export interface Channel {
    id: number, // Unique identifier for the channel
    name: string, // Name of the channel
    channel_number: number, // Channel number,
    epg?: string, // EPG guide entry name
    logo?: string // Optional logo for overriding logo
}

// Interface representing a source linked to a channel
export interface ChannelSource {
    id: number, // Unique identifier for the channel source
    channel_id: number, // ID of the associated channel
    stream_id: number, // ID of the associated stream
    stream_channel: string // Identifier for the stream channel
}

// Internal representation of a channel source with additional properties
export interface ChannelSourceInternal {
    id: string, // Unique identifier for the internal source
    name: string, // Name of the source
    stream: number, // ID of the associated stream

    endpoint: string // Endpoint URL for accessing the source
}

// Interface representing an EPG (Electronic Program Guide) source
export interface EPGSource {
    id: number, // Unique identifier for the EPG source
    name: string, // Name of the EPG source
    epg: string, // EPG data or URL
    last_updated: number, // Timestamp of the last update
    langRegex?: string, // Regex pattern for filtering EPG data by lang
    nameRegex?: string, // Regex pattern for filtering by name
    idRegex?: string, // Regex pattern for filtering by id
    healthy: number // The current health status for the epg data (-1 retrying, 0 failed, 1 healthy, 2 refreshing)
}

// Interface for remapping EPG data
export interface EPGRemap {
    original: string, // Original EPG data to be remapped
    new: string // New EPG data after remapping
}

export type EPGChannelMap = {
    [epgName: string] : {
        name: string,
        logo?: string,
        epg?: string,
        channel_number: number
    }
}