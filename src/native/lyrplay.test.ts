import { describe, expect, it } from 'vitest'
import { connectionMessage, parseHostParams, playerMessage } from './lyrplay'

// The query strings LyrPlay builds (ContentView.swift materialWebURL)
const LYRPLAY = '?hide=mediaControls&nativePlayer=w&nativeConnectionStatus=w&topPad=59&appSettings=lmsstream://settings&appSettingsName=iOS%20App%20Settings'
const LYRPLAY_FOCUS = '?player=iPhone&single&hide=mediaControls&nativePlayer=w&nativeConnectionStatus=w&appSettings=lmsstream://settings&appSettingsName=iOS%20App%20Settings'

describe('parseHostParams', () => {
  it('reads LyrPlay params', () => {
    expect(parseHostParams(LYRPLAY)).toEqual({
      native: true,
      connectionStatus: true,
      settings: { url: 'lmsstream://settings', name: 'iOS App Settings' },
      focusPlayer: undefined,
    })
  })
  it('focuses on the named player only with single', () => {
    expect(parseHostParams(LYRPLAY_FOCUS).focusPlayer).toBe('iPhone')
    expect(parseHostParams('?player=iPhone').focusPlayer).toBeUndefined()
  })
  it('ignores bridge values other than w', () => {
    expect(parseHostParams('?nativePlayer=3').native).toBe(false)
  })
  it('is inert in a plain browser', () => {
    expect(parseHostParams('')).toEqual({ native: false, connectionStatus: false, settings: undefined, focusPlayer: undefined })
  })
})

describe('playerMessage', () => {
  it('uses the line format LyrPlay parses', () => {
    expect(playerMessage({ id: 'aa:bb:cc:dd:ee:ff', name: 'Kitchen', ip: '192.168.1.50:34657' })).toBe(
      'MATERIAL-PLAYER\nID aa:bb:cc:dd:ee:ff\nNAME Kitchen\nIP 192.168.1.50:34657',
    )
  })
  it('omits unknown name and IP', () => {
    expect(playerMessage({ id: 'aa:bb:cc:dd:ee:ff' })).toBe('MATERIAL-PLAYER\nID aa:bb:cc:dd:ee:ff')
  })
})

describe('connectionMessage', () => {
  it("keeps Material's spelling", () => {
    expect(connectionMessage(false)).toBe('MATERIAL-CONNETIONSTATUS\nCONNECTED false')
  })
})
