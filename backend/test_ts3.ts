
class Test {
  getArr(key: string) { return [] }
  test() {
    const classifications = this.getArr('classifications')
    const fileResults = classifications.map((c, i) => {
      const modeVal = 'graph'
      return {
        mode: modeVal,
        flashcards: [],
      }
    })
  }
}
