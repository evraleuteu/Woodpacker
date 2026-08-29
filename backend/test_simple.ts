
class Test {
  baseUrl = 'http://localhost'
  test() {
    let mergedResult: Record<string, unknown> = { extraction_mode: 'graph' }
    let modeVal: string
    const extractionMode = this.baseUrl
    if (extractionMode) {
      let modeVal: string = extractionMode
    } else {
      let modeVal: string = 'graph'
    }
    return modeVal
  }
}
