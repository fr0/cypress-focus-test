describe('main', function() {
  it('has a popup', function () {
    cy.visit('/');
    cy.get('button.expand').click();
    cy.get('#input1').type('aaa');
    cy.get('#input2').type('bbb');
    cy.get('#result1').should('have.text', 'text1 is: aaa');
    cy.get('#result2').should('have.text', 'text2 is: bbb');
  });
});
