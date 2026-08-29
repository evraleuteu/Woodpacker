
class Test {
  getArr(key: string): string[] { return [] }
  test() {
    const getArr = (key: string): string[] => {
      return []
    }
    const classifications = getArr('classifications')
    const modeVal = 'graph'
    return { mode: modeVal }
  }
}
