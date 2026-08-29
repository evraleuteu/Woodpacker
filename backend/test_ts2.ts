
class Test {
  getArr(key: string) { return [] }
  test() {
    const classifications = this.getArr('classifications')
    const modeVal = 'graph'
    return { mode: modeVal }
  }
}
